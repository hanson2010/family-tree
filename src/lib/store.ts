import { randomBytes } from 'node:crypto';
import type { DocumentReference, Transaction } from '@google-cloud/firestore';
import { BucketTable } from '@/lib/bucket-table';
import { getFirestore } from '@/lib/firestore';
import type { Person, Relationship } from '@/types';

/**
 * Persons and relationships, kept in bucket documents (see BucketTable) so that loading all of
 * them takes a few document reads. A metadata document counts every change: each server instance
 * keeps the data it last loaded and, per request, reads only that counter (1 read) unless the
 * data changed. Every change runs in a transaction that reads and raises the counter, so changes
 * never overwrite each other. Avatars are kept apart, one document per person, and are read only
 * when shown.
 */

const PERSON_BUCKETS = 'PersonBucket';
const RELATIONSHIP_BUCKETS = 'RelationshipBucket';
/** Avatar of a person: { image: data URL, version }, under the person's id */
const PERSON_AVATARS = 'PersonAvatar';
/** The store's metadata: { status, version } */
const META = { collection: 'Store', doc: 'meta' };
/** Where persons and relationships were kept before buckets, one document each */
const LEGACY = { persons: 'Person', relationships: 'Relationship' };

/** A person as stored: the avatar is a separate document, named by its version */
export type StoredPerson = Omit<Person, 'avatar'> & { avatarVersion?: string | null };

export interface Store {
  version: number;
  persons: BucketTable<StoredPerson>;
  relationships: BucketTable<Relationship>;
}

/** Sortable, unique ids for buckets and avatar versions */
export const newId = () => `${Date.now().toString(36)}${randomBytes(4).toString('hex')}`;

const db = () => getFirestore();
const metaRef = () => db().collection(META.collection).doc(META.doc);
export const avatarRef = (personId: string) => db().collection(PERSON_AVATARS).doc(personId);

interface Meta {
  status: 'migrating' | 'ready';
  version: number;
  startedAt?: unknown;
}

/** This instance's copy of the store, current as of `version` */
let cache: Store | null = null;

async function loadBuckets(tx: Transaction, version: number): Promise<Store> {
  const [persons, relationships] = await Promise.all([
    tx.get(db().collection(PERSON_BUCKETS)),
    tx.get(db().collection(RELATIONSHIP_BUCKETS)),
  ]);
  const buckets = (snap: typeof persons) => snap.docs.map((d) => ({ id: d.id, data: String(d.get('data') ?? '[]') }));
  return {
    version,
    persons: BucketTable.fromBuckets<StoredPerson>(buckets(persons), newId),
    relationships: BucketTable.fromBuckets<Relationship>(buckets(relationships), newId),
  };
}

/** The current store, read-only: costs 1 read when this instance's copy is current */
export async function readStore(): Promise<Store> {
  for (;;) {
    const store = await db().runTransaction(
      async (tx) => {
        const meta = (await tx.get(metaRef())).data() as Meta | undefined;
        if (meta?.status !== 'ready') return null;
        if (cache?.version === meta.version) return cache;
        return loadBuckets(tx, meta.version);
      },
      { readOnly: true }
    );
    if (store) return (cache = store);
    await migrate();
  }
}

/**
 * Change the store: `change` gets a copy of the current store to change (and the transaction,
 * for other documents: read them before writing anything). The changed buckets and the raised
 * counter are written together. `change` may run more than once when saves collide, so it must
 * not have other side effects.
 */
export async function writeStore<R>(change: (store: Store, tx: Transaction) => R | Promise<R>): Promise<R> {
  await readStore(); // migrates if needed and warms this instance's copy
  let committed: Store | null = null;
  const result = await db().runTransaction(async (tx) => {
    const meta = (await tx.get(metaRef())).data() as Meta;
    const base = cache?.version === meta.version ? cache : await loadBuckets(tx, meta.version);
    const work: Store = { version: meta.version + 1, persons: base.persons.clone(), relationships: base.relationships.clone() };
    const value = await change(work, tx);
    writeDirty(tx, PERSON_BUCKETS, work.persons);
    writeDirty(tx, RELATIONSHIP_BUCKETS, work.relationships);
    tx.update(metaRef(), { version: work.version, updatedAt: new Date() });
    committed = work;
    return value;
  });
  if (committed) {
    const store = committed as Store;
    store.persons.dirty.clear();
    store.relationships.dirty.clear();
    cache = store;
  }
  return result;
}

function writeDirty<T extends { id: string }>(tx: Transaction, collection: string, table: BucketTable<T>) {
  for (const bucketId of table.dirty) {
    const ref = db().collection(collection).doc(bucketId);
    const data = table.serialize(bucketId);
    if (data === null) tx.delete(ref);
    else tx.set(ref, { data });
  }
}

// ---------------------------------------------------------------- one-time migration

/** A migration that has not finished in this time is taken to have failed, and is started again */
const MIGRATION_TIMEOUT_MS = 5 * 60 * 1000;

const toIso = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  const timestamp = value as { toDate?: () => Date } | undefined;
  if (typeof timestamp?.toDate === 'function') return timestamp.toDate().toISOString();
  return value ? new Date(String(value)).toISOString() : new Date().toISOString();
};

const toMillis = (value: unknown) => (value as { toMillis?: () => number })?.toMillis?.() ?? 0;

/**
 * Move persons and relationships from one document each into buckets, and avatars into their own
 * documents. One instance does this, holding a lock in the metadata document; the others wait.
 * The old documents are left as they were.
 */
async function migrate(): Promise<void> {
  if (!(await takeMigrationLock())) {
    await waitForMigration();
    return;
  }
  // A failed earlier attempt may have left buckets behind
  for (const collection of [PERSON_BUCKETS, RELATIONSHIP_BUCKETS]) {
    const old = await db().collection(collection).get();
    const writer = db().bulkWriter();
    old.docs.forEach((d) => writer.delete(d.ref));
    await writer.close();
  }

  const [legacyPersons, legacyRelationships] = await Promise.all([
    db().collection(LEGACY.persons).get(),
    db().collection(LEGACY.relationships).get(),
  ]);

  const persons = new BucketTable<StoredPerson>(newId);
  const avatars = db().bulkWriter();
  for (const d of legacyPersons.docs) {
    const { avatar, createdAt, updatedAt, ...fields } = d.data() as Person & { avatar?: string | null };
    let avatarVersion: string | null = null;
    if (avatar) {
      avatarVersion = newId();
      avatars.set(avatarRef(d.id) as DocumentReference, { image: avatar, version: avatarVersion });
    }
    persons.put({ ...fields, id: d.id, avatarVersion, createdAt: toIso(createdAt), updatedAt: toIso(updatedAt) } as StoredPerson);
  }
  await avatars.close();

  const relationships = new BucketTable<Relationship>(newId);
  for (const d of legacyRelationships.docs) {
    const { createdAt, updatedAt, ...fields } = d.data() as Relationship;
    relationships.put({ ...fields, id: d.id, createdAt: toIso(createdAt), updatedAt: toIso(updatedAt) } as Relationship);
  }

  const batch = db().batch();
  for (const [collection, table] of [
    [PERSON_BUCKETS, persons],
    [RELATIONSHIP_BUCKETS, relationships],
  ] as const) {
    for (const bucketId of table.dirty) {
      const data = table.serialize(bucketId);
      if (data !== null) batch.set(db().collection(collection).doc(bucketId), { data });
    }
  }
  batch.set(metaRef(), { status: 'ready', version: 1, migratedAt: new Date() });
  await batch.commit();
  console.log(
    `Store migrated: ${persons.size} persons, ${relationships.size} relationships into buckets; old documents kept.`
  );
}

/** True when this instance may migrate: no migration has started, or the last one timed out */
async function takeMigrationLock(): Promise<boolean> {
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(metaRef());
    const meta = snap.data() as Meta | undefined;
    if (meta?.status === 'ready') return false;
    if (meta?.status === 'migrating' && Date.now() - toMillis(meta.startedAt) < MIGRATION_TIMEOUT_MS) return false;
    tx.set(metaRef(), { status: 'migrating', version: 0, startedAt: new Date() });
    return true;
  });
}

async function waitForMigration(): Promise<void> {
  const deadline = Date.now() + MIGRATION_TIMEOUT_MS + 10_000;
  while (Date.now() < deadline) {
    const meta = (await metaRef().get()).data() as Meta | undefined;
    if (meta?.status === 'ready') return;
    if (meta?.status === 'migrating' && Date.now() - toMillis(meta.startedAt) >= MIGRATION_TIMEOUT_MS) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Timed out waiting for the data migration to finish.');
}
