import { v4 as uuidv4 } from 'uuid';
import type { Transaction } from '@google-cloud/firestore';
import type { z } from 'zod';
import { KINDS, deleteEntity, getFirestore, queryEntitiesByProperty } from '@/lib/firestore';
import { describe, findDuplicate } from '@/lib/person-duplicates';
import { findOwnSavedAvatar, personRequestSchema } from '@/lib/person-save';
import { ORDERED_MARRIAGE_TYPES, shouldSwapPartners } from '@/lib/relationship-direction';
import { planMerge } from '@/lib/merge';
import { mergeOtherNames } from '@/lib/other-names';
import { isSamePerson } from '@/lib/person-identity';
import { importCommitSchema, type ImportRef, type ImportResult } from '@/lib/import';
import { avatarRef, newId, readStore, writeStore, type Store, type StoredPerson } from '@/lib/store';
import type { Person, Relationship, RelationshipType, SavedAvatar } from '@/types';
import { centeredAvatar, normalizeAvatar } from '@/lib/faces';
import { personSchema, relationshipSchema } from '@/types';

/**
 * The rules for reading and changing persons and relationships, shared by the app's API routes
 * and the MCP tools, so both enforce the same ownership, privacy and duplicate checks.
 * `userId` is the signed-in user (or the owner of an API token); undefined means anonymous.
 * Persons and relationships live in the bucket store (see store.ts); each change is one
 * transaction over it.
 */

/** A refused request, with the HTTP status that describes it */
export class ServiceError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

const isVisible = (person: StoredPerson, userId?: string) => !person.isPrivate || person.createdBy === userId;

function requireUser(userId?: string): string {
  if (!userId) throw new ServiceError(401, 'Unauthorized');
  return userId;
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new ServiceError(400, result.error.message);
  return result.data;
}

const now = () => new Date().toISOString();

/** A stored person as the app sees it: the avatar as an image address that changes with the image */
function toPerson(stored: StoredPerson): Person {
  const { avatarVersion, ...person } = stored;
  return { ...person, avatar: avatarVersion ? `/api/persons/${stored.id}/avatar?v=${avatarVersion}` : null };
}

function visiblePerson(store: Store, id: string, userId?: string): StoredPerson {
  const person = store.persons.get(id);
  // Another user's private person is reported as missing, so its existence is not revealed
  if (!person || !isVisible(person, userId)) throw new ServiceError(404, 'Person not found');
  return person;
}

function ownPerson(store: Store, id: string, userId: string): StoredPerson {
  const person = visiblePerson(store, id, userId);
  if (person.createdBy !== userId) throw new ServiceError(403, 'Only the person’s creator can change them');
  return person;
}

const duplicateMessage = (p: Pick<Person, 'name' | 'birthYear'>) =>
  `Already in the tree: ${describe(p)}. This looks like the same person.`;

/** A public person must not duplicate one the user can see, other than those in `excludeIds` */
function checkDuplicate(store: Store, person: Parameters<typeof isSamePerson>[0] & { isPrivate: boolean }, userId: string, excludeIds: string[] = []) {
  if (person.isPrivate) return;
  const duplicate = findDuplicate(store.persons.all(), person, userId, excludeIds);
  if (duplicate) throw new ServiceError(409, duplicateMessage(duplicate));
}

// ---------------------------------------------------------------- persons

/** Persons the user can see: public ones and their own */
export async function listVisiblePersons(userId?: string): Promise<Person[]> {
  return (await readStore()).persons.all().filter((p) => isVisible(p, userId)).map(toPerson);
}

export async function getVisiblePerson(id: string, userId?: string): Promise<Person> {
  return toPerson(visiblePerson(await readStore(), id, userId));
}

/** The avatar of a person the user can see, as a JPEG data URL, or null when they have none */
export async function getPersonAvatar(id: string, userId?: string): Promise<{ person: Person; image: string | null }> {
  const person = visiblePerson(await readStore(), id, userId);
  if (!person.avatarVersion) return { person: toPerson(person), image: null };
  const image = (await avatarRef(id).get()).get('image');
  return { person: toPerson(person), image: typeof image === 'string' ? image : null };
}

/** A new avatar from a save request: a data: URL re-encoded as the avatar JPEG; anything else is none */
async function requestedAvatar(avatar: string | null | undefined): Promise<string | null> {
  if (!avatar?.startsWith('data:')) return null;
  try {
    return await normalizeAvatar(avatar);
  } catch {
    throw new ServiceError(400, 'The avatar image could not be read.');
  }
}

/**
 * Give `person` a new avatar (a data URL), or remove theirs (null), in transaction `tx`.
 * Returns the person with the matching avatar version.
 */
function setAvatar(tx: Transaction, person: StoredPerson, image: string | null): StoredPerson {
  if (image === null) {
    if (person.avatarVersion) tx.delete(avatarRef(person.id));
    return { ...person, avatarVersion: null };
  }
  const version = newId();
  tx.set(avatarRef(person.id), { image, version });
  return { ...person, avatarVersion: version };
}

/** Read one of the user's saved faces in transaction `tx`; refused when it is gone or someone else's */
async function readSavedFace(tx: Transaction, faceId: string, userId: string): Promise<SavedAvatar> {
  const snap = await tx.get(getFirestore().collection(KINDS.AVATAR).doc(faceId));
  const face = snap.data() as Omit<SavedAvatar, 'id'> | undefined;
  if (!face || face.createdBy !== userId) throw new ServiceError(409, 'The saved face is no longer available.');
  return { id: faceId, ...face };
}

export async function createPerson(userId: string | undefined, input: unknown): Promise<Person> {
  const uid = requireUser(userId);
  const data = parse(personRequestSchema, input);
  const uploaded = await requestedAvatar(data.avatar);

  return writeStore(async (store, tx) => {
    // A saved face is used as stored, not as sent by the client
    const face = data.savedAvatarId ? await readSavedFace(tx, data.savedAvatarId, uid) : null;
    checkDuplicate(store, data, uid);

    const time = now();
    let person: StoredPerson = {
      id: uuidv4(),
      name: data.name,
      courtesyName: data.courtesyName,
      artName: data.artName,
      otherNames: data.otherNames ?? [],
      gender: data.gender,
      birthYear: data.birthYear ?? null,
      birthMonth: data.birthMonth ?? null,
      birthDay: data.birthDay ?? null,
      deathYear: data.deathYear ?? null,
      deathMonth: data.deathMonth ?? null,
      deathDay: data.deathDay ?? null,
      link: data.link ?? '',
      description: data.description ?? '',
      avatarVersion: null,
      isPrivate: data.isPrivate,
      createdBy: uid,
      createdAt: time,
      updatedAt: time,
    };
    const image = face?.image ?? uploaded;
    if (image) person = setAvatar(tx, person, image);
    if (face) tx.delete(getFirestore().collection(KINDS.AVATAR).doc(face.id));
    store.persons.put(person);
    return toPerson(person);
  });
}

export async function updatePerson(userId: string | undefined, id: string, input: unknown): Promise<Person> {
  const uid = requireUser(userId);
  const data = parse(personRequestSchema, input);
  const uploaded = await requestedAvatar(data.avatar);

  return writeStore(async (store, tx) => {
    const face = data.savedAvatarId ? await readSavedFace(tx, data.savedAvatarId, uid) : null;
    const existing = ownPerson(store, id, uid);
    checkDuplicate(store, data, uid, [id]);

    let updated: StoredPerson = {
      ...existing,
      name: data.name,
      courtesyName: data.courtesyName,
      artName: data.artName,
      otherNames: data.otherNames ?? existing.otherNames ?? [],
      gender: data.gender,
      birthYear: data.birthYear ?? null,
      birthMonth: data.birthMonth ?? null,
      birthDay: data.birthDay ?? null,
      deathYear: data.deathYear ?? null,
      deathMonth: data.deathMonth ?? null,
      deathDay: data.deathDay ?? null,
      link: data.link ?? existing.link ?? '',
      description: data.description ?? existing.description ?? '',
      isPrivate: data.isPrivate,
      updatedAt: now(),
    };
    // A saved face or an uploaded image replaces the avatar; null removes it; else it is kept
    const image = face?.image ?? uploaded;
    if (image) updated = setAvatar(tx, updated, image);
    else if (data.avatar === null && !face) updated = setAvatar(tx, updated, null);
    if (face) tx.delete(getFirestore().collection(KINDS.AVATAR).doc(face.id));
    store.persons.put(updated);
    // A changed gender can change which partner comes first in this person's marriages
    if (updated.gender !== existing.gender) reorderMarriages(store, id);
    return toPerson(updated);
  });
}

/**
 * Put the woman first (person A) in each spouse and concubine relationship of a person, as all
 * marriages are stored. Same-sex and unknown-gender pairs keep their order.
 */
function reorderMarriages(store: Store, personId: string): void {
  for (const r of relationshipsOf(store, personId)) {
    if (!ORDERED_MARRIAGE_TYPES.includes(r.type)) continue;
    const genderA = store.persons.get(r.personAId)?.gender;
    const genderB = store.persons.get(r.personBId)?.gender;
    if (shouldSwapPartners(r.type, genderA, genderB)) {
      store.relationships.put({ ...r, personAId: r.personBId, personBId: r.personAId, updatedAt: now() });
    }
  }
}

// ---------------------------------------------------------------- avatars

/** Largest image accepted for an avatar, as for uploads in the app */
const MAX_AVATAR_IMAGE_BYTES = 10 * 1024 * 1024;

/** An avatar (square JPEG data URL) from an image: scaled so the short edge is 256px, middle square */
async function avatarFromImage(image: Buffer): Promise<string> {
  if (image.length > MAX_AVATAR_IMAGE_BYTES) throw new ServiceError(400, 'The image is larger than 10MB.');
  try {
    return await centeredAvatar(image);
  } catch {
    throw new ServiceError(400, 'The image could not be read. Send a JPEG, PNG, GIF or WebP image.');
  }
}

/**
 * Give one of the user's persons an avatar made from an image: scaled so the short edge is 256px,
 * then the middle square, as uploads in the person form. `null` removes the avatar.
 */
export async function setPersonAvatar(userId: string | undefined, id: string, image: Buffer | null): Promise<Person> {
  const uid = requireUser(userId);
  const avatar = image ? await avatarFromImage(image) : null;
  return writeStore((store, tx) => {
    const updated = setAvatar(tx, { ...ownPerson(store, id, uid), updatedAt: now() }, avatar);
    store.persons.put(updated);
    return toPerson(updated);
  });
}

/** The user's saved faces from group photos, newest first */
export async function listSavedFaces(userId: string | undefined): Promise<SavedAvatar[]> {
  const uid = requireUser(userId);
  const faces = await queryEntitiesByProperty<SavedAvatar>(KINDS.AVATAR, 'createdBy', uid);
  const time = (v: unknown) => (v instanceof Date ? v.getTime() : (v as { toMillis?: () => number })?.toMillis?.() ?? 0);
  return faces.sort((a, b) => time(b.createdAt) - time(a.createdAt));
}

/** Give a person one of the user's saved faces; the face leaves the saved list in the same step */
export async function useSavedFace(userId: string | undefined, personId: string, faceId: string): Promise<Person> {
  const uid = requireUser(userId);
  return writeStore(async (store, tx) => {
    const face = await readSavedFace(tx, faceId, uid);
    const updated = setAvatar(tx, { ...ownPerson(store, personId, uid), updatedAt: now() }, face.image);
    tx.delete(getFirestore().collection(KINDS.AVATAR).doc(face.id));
    store.persons.put(updated);
    return toPerson(updated);
  });
}

/** Most saved faces one user may keep */
export const MAX_SAVED_FACES = 500;

/** Save avatar images (square JPEG data URLs, already normalized) as the user's saved faces */
export async function saveFaces(userId: string | undefined, images: string[]): Promise<SavedAvatar[]> {
  const uid = requireUser(userId);
  const existing = await queryEntitiesByProperty<SavedAvatar>(KINDS.AVATAR, 'createdBy', uid);
  if (existing.length + images.length > MAX_SAVED_FACES) {
    throw new ServiceError(400, `At most ${MAX_SAVED_FACES} saved faces; use or delete some first.`);
  }
  const time = new Date();
  const faces: SavedAvatar[] = images.map((image) => ({ id: uuidv4(), image, createdBy: uid, createdAt: time }));
  const db = getFirestore();
  const batch = db.batch();
  faces.forEach(({ id, ...data }) => batch.set(db.collection(KINDS.AVATAR).doc(id), data));
  await batch.commit();
  return faces;
}

/**
 * Save a photo of one face as one of the user's saved faces, not yet given to a person: cropped
 * like a person's avatar (short edge 256px, middle square).
 */
export async function saveFaceFromImage(userId: string | undefined, image: Buffer): Promise<SavedAvatar> {
  requireUser(userId);
  const [face] = await saveFaces(userId, [await avatarFromImage(image)]);
  return face;
}

/** Delete one of the user's saved faces */
export async function deleteSavedFace(userId: string | undefined, faceId: string): Promise<void> {
  const uid = requireUser(userId);
  // Another user's face is reported as missing, so its existence is not revealed
  if (!(await findOwnSavedAvatar(faceId, uid))) throw new ServiceError(404, 'Saved face not found');
  await deleteEntity(KINDS.AVATAR, faceId);
}

// ---------------------------------------------------------------- merging

const mergeFieldsSchema = personSchema.omit({ avatar: true });

/**
 * Merge `otherId` into `keepId`, in one transaction: the kept person gets `fields` (other names
 * left out become both persons' other names and names, without the merged name) and the avatar
 * named by `avatarFrom`, the other person's relationships move to the kept one (except those
 * between the two and those the kept one already has), and the other person is deleted. Both
 * persons must be the user's own.
 */
export async function mergePersons(
  userId: string | undefined,
  keepId: string,
  otherId: string,
  fields: unknown,
  avatarFrom: 'this' | 'other' | 'none'
): Promise<Person> {
  const uid = requireUser(userId);
  if (otherId === keepId) throw new ServiceError(400, 'Choose a different person.');
  const data = parse(mergeFieldsSchema, fields);

  return writeStore(async (store, tx) => {
    const kept = ownPerson(store, keepId, uid);
    const other = ownPerson(store, otherId, uid);
    // Read before any write in the transaction
    const otherAvatar =
      avatarFrom === 'other' && other.avatarVersion ? ((await tx.get(avatarRef(otherId))).get('image') as string) : null;
    checkDuplicate(store, data, uid, [keepId, otherId]);

    const unique = [...relationshipsOf(store, keepId), ...relationshipsOf(store, otherId)].filter(
      (r, i, all) => all.findIndex((x) => x.id === r.id) === i
    );
    const { moved, dropped } = planMerge(keepId, otherId, unique);

    let merged: StoredPerson = {
      ...kept,
      name: data.name,
      courtesyName: data.courtesyName,
      artName: data.artName,
      otherNames: data.otherNames ?? mergeOtherNames(kept, other, data.name),
      gender: data.gender,
      birthYear: data.birthYear ?? null,
      birthMonth: data.birthMonth ?? null,
      birthDay: data.birthDay ?? null,
      deathYear: data.deathYear ?? null,
      deathMonth: data.deathMonth ?? null,
      deathDay: data.deathDay ?? null,
      link: data.link ?? (kept.link || other.link || ''),
      description: data.description ?? (kept.description || other.description || ''),
      isPrivate: data.isPrivate,
      updatedAt: now(),
    };
    if (avatarFrom === 'other') merged = setAvatar(tx, merged, otherAvatar);
    else if (avatarFrom === 'none') merged = setAvatar(tx, merged, null);
    if (other.avatarVersion) tx.delete(avatarRef(otherId));

    store.persons.put(merged);
    store.persons.remove(otherId);
    dropped.forEach((id) => store.relationships.remove(id));
    moved.forEach((r) => store.relationships.put({ ...r, updatedAt: now() }));
    // The kept person's marriages, moved or their own, keep the woman as person A
    reorderMarriages(store, keepId);
    return toPerson(merged);
  });
}

/** Delete one of the user's persons together with all of their relationships, in one transaction */
export async function deletePerson(userId: string | undefined, id: string): Promise<{ relationshipsDeleted: number }> {
  const uid = requireUser(userId);
  return writeStore((store, tx) => {
    const person = ownPerson(store, id, uid);
    const relationships = relationshipsOf(store, id);
    relationships.forEach((r) => store.relationships.remove(r.id));
    store.persons.remove(id);
    if (person.avatarVersion) tx.delete(avatarRef(id));
    return { relationshipsDeleted: relationships.length };
  });
}

// ---------------------------------------------------------------- relationships

function relationshipsOf(store: Store, personId: string): Relationship[] {
  return store.relationships.all().filter((r) => r.personAId === personId || r.personBId === personId);
}

/**
 * Relationships between persons the user can see, optionally only those of one person. A
 * relationship involving another user's private person is left out.
 */
export async function listVisibleRelationships(userId?: string, personId?: string): Promise<Relationship[]> {
  const store = await readStore();
  const relationships = personId ? relationshipsOf(store, personId) : store.relationships.all();
  const seen = (id: string) => {
    const person = store.persons.get(id);
    return !!person && isVisible(person, userId);
  };
  return relationships.filter((r) => seen(r.personAId) && seen(r.personBId));
}

function visibleRelationship(store: Store, id: string, userId?: string): Relationship {
  const relationship = store.relationships.get(id);
  const a = relationship && store.persons.get(relationship.personAId);
  const b = relationship && store.persons.get(relationship.personBId);
  if (!relationship || !a || !b || !isVisible(a, userId) || !isVisible(b, userId)) {
    throw new ServiceError(404, 'Relationship not found');
  }
  return relationship;
}

export async function getVisibleRelationship(id: string, userId?: string): Promise<Relationship> {
  return visibleRelationship(await readStore(), id, userId);
}

/** Both persons of a relationship, in stored order: the woman first in a marriage */
function orderedPair(store: Store, type: RelationshipType, personAId: string, personBId: string, userId: string) {
  if (personAId === personBId) throw new ServiceError(400, 'A relationship needs two different persons.');
  const a = visiblePerson(store, personAId, userId);
  const b = visiblePerson(store, personBId, userId);
  return ORDERED_MARRIAGE_TYPES.includes(type) && shouldSwapPartners(type, a.gender, b.gender)
    ? { personAId: b.id, personBId: a.id }
    : { personAId: a.id, personBId: b.id };
}

/** Relationships of this type between the two persons, in either order */
function findBetween(store: Store, personAId: string, personBId: string, type: RelationshipType): Relationship[] {
  return store.relationships
    .all()
    .filter(
      (r) =>
        r.type === type &&
        ((r.personAId === personAId && r.personBId === personBId) || (r.personAId === personBId && r.personBId === personAId))
    );
}

/**
 * Create a relationship; when the same relationship between the two persons exists already,
 * that one is returned instead ("Add Family Relationships" sends the parents' marriage again).
 */
export async function createRelationship(
  userId: string | undefined,
  input: unknown
): Promise<{ relationship: Relationship; existed: boolean }> {
  const uid = requireUser(userId);
  const data = parse(relationshipSchema, input);
  return writeStore((store) => {
    const pair = orderedPair(store, data.type, data.personAId, data.personBId, uid);
    const [existing] = findBetween(store, pair.personAId, pair.personBId, data.type);
    if (existing) return { relationship: existing, existed: true };

    const time = now();
    const relationship: Relationship = {
      id: uuidv4(),
      ...pair,
      type: data.type,
      startYear: data.startYear ?? null,
      startMonth: data.startMonth ?? null,
      startDay: data.startDay ?? null,
      endYear: data.endYear ?? null,
      endMonth: data.endMonth ?? null,
      endDay: data.endDay ?? null,
      createdBy: uid,
      createdAt: time,
      updatedAt: time,
    };
    store.relationships.put(relationship);
    return { relationship, existed: false };
  });
}

function ownRelationship(store: Store, id: string, userId: string): Relationship {
  const relationship = visibleRelationship(store, id, userId);
  if (relationship.createdBy !== userId) throw new ServiceError(403, 'Only the relationship’s creator can change it');
  return relationship;
}

export async function updateRelationship(userId: string | undefined, id: string, input: unknown): Promise<Relationship> {
  const uid = requireUser(userId);
  const data = parse(relationshipSchema, input);
  return writeStore((store) => {
    const existing = ownRelationship(store, id, uid);
    const pair = orderedPair(store, data.type, data.personAId, data.personBId, uid);
    // A changed type must not duplicate another relationship between the same two persons
    if (findBetween(store, pair.personAId, pair.personBId, data.type).some((r) => r.id !== id)) {
      throw new ServiceError(409, 'These two persons already have this relationship.');
    }
    const updated: Relationship = {
      ...existing,
      ...pair,
      type: data.type,
      startYear: data.startYear ?? null,
      startMonth: data.startMonth ?? null,
      startDay: data.startDay ?? null,
      endYear: data.endYear ?? null,
      endMonth: data.endMonth ?? null,
      endDay: data.endDay ?? null,
      updatedAt: now(),
    };
    store.relationships.put(updated);
    return updated;
  });
}

export async function deleteRelationship(userId: string | undefined, id: string): Promise<void> {
  const uid = requireUser(userId);
  await writeStore((store) => {
    ownRelationship(store, id, uid);
    store.relationships.remove(id);
  });
}

// ---------------------------------------------------------------- import

/**
 * Save reviewed persons and relationships from an import in one transaction. Public persons must
 * not duplicate a person the user can see, nor another person in the import; relationships that
 * exist already are skipped.
 */
export async function importRecords(userId: string | undefined, input: unknown): Promise<ImportResult> {
  const uid = requireUser(userId);
  const { isPrivate, persons, relationships } = parse(importCommitSchema, input);

  const keys = new Set(persons.map((p) => p.key));
  if (keys.size !== persons.length) throw new ServiceError(400, 'Duplicate person keys.');
  if (relationships.some((r) => [r.a, r.b].some((x) => 'key' in x && !keys.has(x.key)))) {
    throw new ServiceError(400, 'A relationship refers to a person not in the import.');
  }

  return writeStore((store) => {
    // Every relationship end must be a person in this import or one the user can see
    const existing = new Map<string, StoredPerson>();
    for (const x of relationships.flatMap((r) => [r.a, r.b])) {
      if (!('id' in x)) continue;
      const person = store.persons.get(x.id);
      if (!person || !isVisible(person, uid)) throw new ServiceError(400, 'Unknown person.');
      existing.set(x.id, person);
    }

    if (!isPrivate) {
      const problems: string[] = [];
      persons.forEach((p, i) => {
        const duplicate = findDuplicate(store.persons.all(), p, uid);
        if (duplicate) problems.push(`${p.name} = ${describe(duplicate)}`);
        const earlier = persons.slice(0, i).find((q) => isSamePerson(p, q));
        if (earlier) problems.push(`${p.name} = ${earlier.name} (twice in this import)`);
      });
      if (problems.length > 0) {
        throw new ServiceError(409, `These look like persons already in the tree: ${problems.join('; ')}`);
      }
    }

    const time = now();
    const created = new Map<string, StoredPerson>(
      persons.map((p) => [
        p.key,
        {
          id: uuidv4(),
          name: p.name,
          courtesyName: p.courtesyName,
          artName: p.artName,
          otherNames: p.otherNames ?? [],
          gender: p.gender,
          birthYear: p.birthYear ?? null,
          birthMonth: p.birthMonth ?? null,
          birthDay: p.birthDay ?? null,
          deathYear: p.deathYear ?? null,
          deathMonth: p.deathMonth ?? null,
          deathDay: p.deathDay ?? null,
          link: p.link ?? '',
          description: p.description ?? '',
          avatarVersion: null,
          isPrivate,
          createdBy: uid,
          createdAt: time,
          updatedAt: time,
        },
      ])
    );
    const resolve = (x: ImportRef): StoredPerson => ('key' in x ? created.get(x.key)! : existing.get(x.id)!);

    // Relationships that exist already (between persons already in the tree) are skipped
    const signature = (type: RelationshipType, a: string, b: string) => `${type}|${[a, b].sort().join('|')}`;
    const known = new Set(store.relationships.all().map((r) => signature(r.type, r.personAId, r.personBId)));

    let createdRelationships = 0;
    let skipped = 0;
    for (const r of relationships) {
      let a = resolve(r.a);
      let b = resolve(r.b);
      if (a.id === b.id || known.has(signature(r.type, a.id, b.id))) {
        skipped++;
        continue;
      }
      known.add(signature(r.type, a.id, b.id));
      // Spouse and concubine are stored with the woman as person A, as elsewhere in the app
      if (shouldSwapPartners(r.type, a.gender, b.gender)) [a, b] = [b, a];
      store.relationships.put({
        id: uuidv4(),
        personAId: a.id,
        personBId: b.id,
        type: r.type,
        startYear: null,
        startMonth: null,
        startDay: null,
        endYear: null,
        endMonth: null,
        endDay: null,
        createdBy: uid,
        createdAt: time,
        updatedAt: time,
      });
      createdRelationships++;
    }
    created.forEach((p) => store.persons.put(p));
    return { personsCreated: created.size, relationshipsCreated: createdRelationships, relationshipsSkipped: skipped };
  });
}

/** Whether the store holds any person (the sample data is only added to an empty tree) */
export async function hasPersons(): Promise<boolean> {
  return (await readStore()).persons.size > 0;
}

/** Add persons and relationships as they are, e.g. sample data; one transaction */
export async function addRecords(persons: StoredPerson[], relationships: Relationship[]): Promise<void> {
  await writeStore((store) => {
    persons.forEach((p) => store.persons.put(p));
    relationships.forEach((r) => store.relationships.put(r));
  });
}
