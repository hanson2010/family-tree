import { KINDS, getFirestore } from '@/lib/firestore';
import { readStore, writeStore } from '@/lib/store';
import { ServiceError } from '@/lib/family-service';
import type { User } from '@/types';

/**
 * Moving an account: everything it owns goes to another account ID and the old account is removed.
 * Used to merge one account into another (after the user confirms, see the pending merges below)
 * and to give accounts from before identities, whose ID is their Google account ID, a random one.
 *
 * A move is recorded under the old ID before anything moves, with its target, so a move that fails
 * part-way finishes when started again (it only moves what is still under the old ID), and so
 * sessions still holding the old ID follow it (resolveAccountId).
 */

export const IDENTITIES = 'Identity';
const ACCOUNT_MOVES = 'AccountMove';
const PENDING_MERGES = 'PendingMerge';

/** How long a merge waits for the user to confirm it */
const PENDING_MERGE_MINUTES = 10;
/** Firestore allows 500 writes in a batch */
const BATCH_SIZE = 450;

/** Documents outside the store that belong to an account, and the field holding its ID */
const OWNED: { collection: string; field: string }[] = [
  { collection: KINDS.AVATAR, field: 'createdBy' },
  { collection: KINDS.API_TOKEN, field: 'userId' },
  { collection: KINDS.AVATAR_UPLOAD, field: 'userId' },
];

const db = () => getFirestore();
const accountRef = (accountId: string) => db().collection(KINDS.USER).doc(accountId);

export interface MoveCounts {
  persons: number;
  relationships: number;
  faces: number;
  tokens: number;
}

/** Give every document of `collection` with `field == from` the value `to`; how many changed */
async function moveField(collection: string, field: string, from: string, to: string): Promise<number> {
  const docs = (await db().collection(collection).where(field, '==', from).get()).docs;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db().batch();
    docs.slice(i, i + BATCH_SIZE).forEach((doc) => batch.update(doc.ref, { [field]: to }));
    await batch.commit();
  }
  return docs.length;
}

/** Move everything account `fromId` owns to `toId` and remove `fromId` (see above) */
export async function moveAccount(fromId: string, toId: string, reason: 'merge' | 'renumber'): Promise<MoveCounts> {
  if (fromId === toId) throw new ServiceError(400, 'An account cannot be moved to itself.');
  const moveRef = db().collection(ACCOUNT_MOVES).doc(fromId);
  await db().runTransaction(async (tx) => {
    const existing = (await tx.get(moveRef)).data() as { toId: string } | undefined;
    if (existing && existing.toId !== toId) throw new ServiceError(409, 'This account has already moved to another account.');
    if (!existing) tx.set(moveRef, { toId, reason, startedAt: new Date(), finishedAt: null });
  });

  const { persons, relationships } = await writeStore((store) => {
    let persons = 0;
    let relationships = 0;
    for (const person of store.persons.all()) {
      if (person.createdBy !== fromId) continue;
      store.persons.put({ ...person, createdBy: toId });
      persons++;
    }
    for (const relationship of store.relationships.all()) {
      if (relationship.createdBy !== fromId) continue;
      store.relationships.put({ ...relationship, createdBy: toId });
      relationships++;
    }
    return { persons, relationships };
  });
  const [faces, tokens] = await Promise.all(OWNED.map(({ collection, field }) => moveField(collection, field, fromId, toId)));

  // Sign-ins land in the new account from here on
  await moveField(IDENTITIES, 'accountId', fromId, toId);

  // The new account keeps what it has and takes the rest (name, picture, email) from the old one
  await db().runTransaction(async (tx) => {
    const [from, to, move] = await Promise.all([tx.get(accountRef(fromId)), tx.get(accountRef(toId)), tx.get(moveRef)]);
    const old = from.data() as Omit<User, 'id'> | undefined;
    if (old) {
      const current = (to.data() ?? {}) as Partial<Omit<User, 'id'>>;
      const kept = Object.fromEntries(Object.entries(current).filter(([, value]) => value != null && value !== ''));
      tx.set(accountRef(toId), {
        ...old,
        ...kept,
        // The earlier of the two
        createdAt: millis(current.createdAt) < millis(old.createdAt) ? current.createdAt : old.createdAt ?? new Date(),
        updatedAt: new Date(),
      });
      tx.delete(accountRef(fromId));
    }
    tx.set(moveRef, { ...move.data(), finishedAt: new Date() });
  });

  resolved.set(fromId, { accountId: toId, at: Date.now() });
  return { persons, relationships, faces, tokens };
}

/** Whether an account ID is a Google account ID, as accounts from before identities have */
export const isLegacyAccountId = (accountId: string) => /^\d+$/.test(accountId);

/**
 * Give an account from before identities a random ID. A second call (say after a failure) uses
 * the ID the first one chose. Returns the new ID.
 */
export async function renumberAccount(accountId: string): Promise<string> {
  const existing = (await db().collection(ACCOUNT_MOVES).doc(accountId).get()).data() as { toId: string } | undefined;
  const toId = existing?.toId ?? db().collection(KINDS.USER).doc().id;
  await moveAccount(accountId, toId, 'renumber');
  return toId;
}

// ---------------------------------------------------------------- sessions of moved accounts

/** How long an instance trusts what it found out about an account ID */
const RESOLVE_TTL_MS = 10 * 60 * 1000;
const resolved = new Map<string, { accountId: string; at: number }>();

/**
 * The account an ID belongs to now: the ID itself, or the account it moved to (and on, should
 * that one have moved too). Sessions signed in before a move use it to follow; it costs one read
 * per ID and instance every 10 minutes.
 */
export async function resolveAccountId(accountId: string): Promise<string> {
  let current = accountId;
  for (let hops = 0; hops < 5; hops++) {
    const cached = resolved.get(current);
    let next: string | null;
    if (cached && Date.now() - cached.at < RESOLVE_TTL_MS) {
      next = cached.accountId === current ? null : cached.accountId;
    } else {
      const move = (await db().collection(ACCOUNT_MOVES).doc(current).get()).data() as { toId?: string } | undefined;
      next = move?.toId ?? null;
      resolved.set(current, { accountId: next ?? current, at: Date.now() });
    }
    if (!next) return current;
    current = next;
  }
  return current;
}

// ---------------------------------------------------------------- merges confirmed by the user

interface PendingMerge {
  /** The account the user is signed in to, which stays */
  survivorId: string;
  /** The account that owned the identity being linked, which is merged in and removed */
  otherId: string;
  identityId: string;
  expiresAt: Date;
}

/** What a merge would move into the signed-in account */
export interface MergeSummary {
  identities: { provider: string; email: string | null; name: string | null }[];
  persons: number;
  relationships: number;
  faces: number;
  tokens: number;
}

const toDate = (value: unknown): Date =>
  value instanceof Date ? value : (value as { toDate: () => Date }).toDate();

/** A stored date (Date or Firestore Timestamp) in milliseconds; missing is latest */
function millis(value: unknown): number {
  if (value == null) return Number.POSITIVE_INFINITY;
  return toDate(value).getTime();
}

/** Record a merge of `otherId` into `survivorId` for the user to confirm; returns its ID */
export async function startMerge(survivorId: string, otherId: string, identityId: string): Promise<string> {
  const ref = db().collection(PENDING_MERGES).doc();
  await ref.set({
    survivorId,
    otherId,
    identityId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + PENDING_MERGE_MINUTES * 60 * 1000),
  });
  return ref.id;
}

/** A pending merge the signed-in account may confirm or cancel */
export async function getPendingMerge(mergeId: string, accountId: string): Promise<PendingMerge> {
  const data = (await db().collection(PENDING_MERGES).doc(mergeId).get()).data();
  if (!data || data.survivorId !== accountId) throw new ServiceError(404, 'Merge not found');
  const merge = { ...data, expiresAt: toDate(data.expiresAt) } as PendingMerge;
  if (merge.expiresAt.getTime() <= Date.now()) {
    throw new ServiceError(410, 'This merge has expired. Link the sign-in method again to merge.');
  }
  return merge;
}

export async function mergeSummary(merge: PendingMerge): Promise<MergeSummary> {
  const [identities, store, faces, tokens] = await Promise.all([
    db().collection(IDENTITIES).where('accountId', '==', merge.otherId).get(),
    readStore(),
    db().collection(KINDS.AVATAR).where('createdBy', '==', merge.otherId).get(),
    db().collection(KINDS.API_TOKEN).where('userId', '==', merge.otherId).get(),
  ]);
  return {
    identities: identities.docs.map((d) => ({
      provider: String(d.get('provider')),
      email: (d.get('email') as string | null) ?? null,
      name: (d.get('name') as string | null) ?? null,
    })),
    persons: store.persons.all().filter((p) => p.createdBy === merge.otherId).length,
    relationships: store.relationships.all().filter((r) => r.createdBy === merge.otherId).length,
    faces: faces.docs.length,
    tokens: tokens.docs.length,
  };
}

/** Merge the other account into the signed-in one */
export async function confirmMerge(mergeId: string, merge: PendingMerge): Promise<MoveCounts> {
  const counts = await moveAccount(merge.otherId, merge.survivorId, 'merge');
  await db().collection(PENDING_MERGES).doc(mergeId).delete();
  return counts;
}

export async function cancelMerge(mergeId: string): Promise<void> {
  await db().collection(PENDING_MERGES).doc(mergeId).delete();
}
