import { v4 as uuidv4 } from 'uuid';
import type { z } from 'zod';
import { KINDS, getEntity, getFirestore, queryEntities, queryEntitiesByProperty } from '@/lib/firestore';
import { describe, findVisibleDuplicate } from '@/lib/person-duplicates';
import { findOwnSavedAvatar, personRequestSchema, reorderMarriages, savePerson } from '@/lib/person-save';
import { ORDERED_MARRIAGE_TYPES, shouldSwapPartners } from '@/lib/relationship-direction';
import type { Person, Relationship, SavedAvatar } from '@/types';
import { centeredAvatar } from '@/lib/faces';
import { relationshipSchema } from '@/types';

/**
 * The rules for reading and changing persons and relationships, shared by the app's API routes
 * and the MCP tools, so both enforce the same ownership, privacy and duplicate checks.
 * `userId` is the signed-in user (or the owner of an API token); undefined means anonymous.
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

const isVisible = (person: Person, userId?: string) => !person.isPrivate || person.createdBy === userId;

function requireUser(userId?: string): string {
  if (!userId) throw new ServiceError(401, 'Unauthorized');
  return userId;
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new ServiceError(400, result.error.message);
  return result.data;
}

// ---------------------------------------------------------------- persons

/** Persons the user can see: public ones and their own */
export async function listVisiblePersons(userId?: string): Promise<Person[]> {
  return (await queryEntities<Person>(KINDS.PERSON)).filter((p) => isVisible(p, userId));
}

export async function getVisiblePerson(id: string, userId?: string): Promise<Person> {
  const person = await getEntity<Person>(KINDS.PERSON, id);
  // Another user's private person is reported as missing, so its existence is not revealed
  if (!person || !isVisible(person, userId)) throw new ServiceError(404, 'Person not found');
  return person;
}

async function ownPerson(id: string, userId: string): Promise<Person> {
  const person = await getEntity<Person>(KINDS.PERSON, id);
  if (!person || !isVisible(person, userId)) throw new ServiceError(404, 'Person not found');
  if (person.createdBy !== userId) throw new ServiceError(403, 'Only the person’s creator can change them');
  return person;
}

const duplicateMessage = (p: Person) => `Already in the tree: ${describe(p)}. This looks like the same person.`;

export async function createPerson(userId: string | undefined, input: unknown): Promise<Person> {
  const uid = requireUser(userId);
  const data = parse(personRequestSchema, input);

  // A public person must not duplicate one already in the tree
  const duplicate = data.isPrivate ? null : await findVisibleDuplicate(data, uid);
  if (duplicate) throw new ServiceError(409, duplicateMessage(duplicate));

  // A saved face is used as stored, not as sent by the client
  const savedAvatar = data.savedAvatarId ? await findOwnSavedAvatar(data.savedAvatarId, uid) : null;
  if (data.savedAvatarId && !savedAvatar) throw new ServiceError(409, 'The saved face is no longer available.');

  const now = new Date();
  const person: Person = {
    id: uuidv4(),
    name: data.name,
    courtesyName: data.courtesyName,
    artName: data.artName,
    gender: data.gender,
    birthYear: data.birthYear ?? null,
    birthMonth: data.birthMonth ?? null,
    birthDay: data.birthDay ?? null,
    deathYear: data.deathYear ?? null,
    deathMonth: data.deathMonth ?? null,
    deathDay: data.deathDay ?? null,
    avatar: savedAvatar?.image ?? data.avatar ?? null,
    isPrivate: data.isPrivate,
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
  };
  await savePerson(person, savedAvatar?.id);
  return person;
}

export async function updatePerson(userId: string | undefined, id: string, input: unknown): Promise<Person> {
  const uid = requireUser(userId);
  const existing = await ownPerson(id, uid);
  const data = parse(personRequestSchema, input);

  const duplicate = data.isPrivate ? null : await findVisibleDuplicate(data, uid, [id]);
  if (duplicate) throw new ServiceError(409, duplicateMessage(duplicate));

  const savedAvatar = data.savedAvatarId ? await findOwnSavedAvatar(data.savedAvatarId, uid) : null;
  if (data.savedAvatarId && !savedAvatar) throw new ServiceError(409, 'The saved face is no longer available.');

  const updated: Person = {
    ...existing,
    name: data.name,
    courtesyName: data.courtesyName,
    artName: data.artName,
    gender: data.gender,
    birthYear: data.birthYear ?? null,
    birthMonth: data.birthMonth ?? null,
    birthDay: data.birthDay ?? null,
    deathYear: data.deathYear ?? null,
    deathMonth: data.deathMonth ?? null,
    deathDay: data.deathDay ?? null,
    avatar: savedAvatar?.image ?? data.avatar ?? null,
    isPrivate: data.isPrivate,
    updatedAt: new Date(),
  };
  await savePerson(updated, savedAvatar?.id);
  // A changed gender can change which partner comes first in this person's marriages
  if (updated.gender !== existing.gender) await reorderMarriages(id, updated.gender);
  return updated;
}

// ---------------------------------------------------------------- avatars

/** Largest image accepted for an avatar, as for uploads in the app */
const MAX_AVATAR_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * Give one of the user's persons an avatar made from an image: scaled so the short edge is 256px,
 * then the middle square, as uploads in the person form. `null` removes the avatar.
 */
export async function setPersonAvatar(userId: string | undefined, id: string, image: Buffer | null): Promise<Person> {
  const uid = requireUser(userId);
  const person = await ownPerson(id, uid);
  let avatar: string | null = null;
  if (image) {
    if (image.length > MAX_AVATAR_IMAGE_BYTES) throw new ServiceError(400, 'The image is larger than 10MB.');
    try {
      avatar = await centeredAvatar(image);
    } catch {
      throw new ServiceError(400, 'The image could not be read. Send a JPEG, PNG, GIF or WebP image.');
    }
  }
  const updated: Person = { ...person, avatar, updatedAt: new Date() };
  await savePerson(updated);
  return updated;
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
  const person = await ownPerson(personId, uid);
  const face = await findOwnSavedAvatar(faceId, uid);
  if (!face) throw new ServiceError(404, 'Saved face not found');
  const updated: Person = { ...person, avatar: face.image, updatedAt: new Date() };
  await savePerson(updated, face.id);
  return updated;
}

/** Delete one of the user's persons together with all of their relationships, in one batch */
export async function deletePerson(userId: string | undefined, id: string): Promise<{ relationshipsDeleted: number }> {
  const uid = requireUser(userId);
  await ownPerson(id, uid);
  const relationships = await relationshipsOf(id);
  const db = getFirestore();
  const batch = db.batch();
  relationships.forEach((r) => batch.delete(db.collection(KINDS.RELATIONSHIP).doc(r.id)));
  batch.delete(db.collection(KINDS.PERSON).doc(id));
  await batch.commit();
  return { relationshipsDeleted: relationships.length };
}

// ---------------------------------------------------------------- relationships

async function relationshipsOf(personId: string): Promise<Relationship[]> {
  const all = [
    ...(await queryEntitiesByProperty<Relationship>(KINDS.RELATIONSHIP, 'personAId', personId)),
    ...(await queryEntitiesByProperty<Relationship>(KINDS.RELATIONSHIP, 'personBId', personId)),
  ];
  return all.filter((r, i) => all.findIndex((x) => x.id === r.id) === i);
}

/**
 * Relationships between persons the user can see, optionally only those of one person. A
 * relationship involving another user's private person is left out.
 */
export async function listVisibleRelationships(userId?: string, personId?: string): Promise<Relationship[]> {
  const relationships = personId
    ? await relationshipsOf(personId)
    : await queryEntities<Relationship>(KINDS.RELATIONSHIP);
  const visible = new Set((await listVisiblePersons(userId)).map((p) => p.id));
  return relationships.filter((r) => visible.has(r.personAId) && visible.has(r.personBId));
}

export async function getVisibleRelationship(id: string, userId?: string): Promise<Relationship> {
  const relationship = await getEntity<Relationship>(KINDS.RELATIONSHIP, id);
  if (!relationship) throw new ServiceError(404, 'Relationship not found');
  const [a, b] = await Promise.all([
    getEntity<Person>(KINDS.PERSON, relationship.personAId),
    getEntity<Person>(KINDS.PERSON, relationship.personBId),
  ]);
  if (!a || !b || !isVisible(a, userId) || !isVisible(b, userId)) throw new ServiceError(404, 'Relationship not found');
  return relationship;
}

/** Both persons of a relationship, in stored order: the woman first in a marriage */
async function orderedPair(type: Relationship['type'], personAId: string, personBId: string, userId: string) {
  if (personAId === personBId) throw new ServiceError(400, 'A relationship needs two different persons.');
  const [a, b] = await Promise.all([getVisiblePerson(personAId, userId), getVisiblePerson(personBId, userId)]);
  return ORDERED_MARRIAGE_TYPES.includes(type) && shouldSwapPartners(type, a.gender, b.gender)
    ? { personAId: b.id, personBId: a.id }
    : { personAId: a.id, personBId: b.id };
}

async function findBetween(personAId: string, personBId: string, type: Relationship['type']) {
  const between = async (a: string, b: string) =>
    queryEntities<Relationship>(KINDS.RELATIONSHIP, [
      { property: 'personAId', operator: '==', value: a },
      { property: 'personBId', operator: '==', value: b },
    ]);
  return [...(await between(personAId, personBId)), ...(await between(personBId, personAId))].filter(
    (r) => r.type === type
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
  const pair = await orderedPair(data.type, data.personAId, data.personBId, uid);

  const [existing] = await findBetween(pair.personAId, pair.personBId, data.type);
  if (existing) return { relationship: existing, existed: true };

  const now = new Date();
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
    createdAt: now,
    updatedAt: now,
  };
  const { id, ...doc } = relationship;
  await getFirestore().collection(KINDS.RELATIONSHIP).doc(id).set(doc);
  return { relationship, existed: false };
}

async function ownRelationship(id: string, userId: string): Promise<Relationship> {
  const relationship = await getEntity<Relationship>(KINDS.RELATIONSHIP, id);
  if (!relationship) throw new ServiceError(404, 'Relationship not found');
  if (relationship.createdBy !== userId) throw new ServiceError(403, 'Only the relationship’s creator can change it');
  return relationship;
}

export async function updateRelationship(userId: string | undefined, id: string, input: unknown): Promise<Relationship> {
  const uid = requireUser(userId);
  const existing = await ownRelationship(id, uid);
  const data = parse(relationshipSchema, input);
  const pair = await orderedPair(data.type, data.personAId, data.personBId, uid);

  // A changed type must not duplicate another relationship between the same two persons
  if ((await findBetween(pair.personAId, pair.personBId, data.type)).some((r) => r.id !== id)) {
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
    updatedAt: new Date(),
  };
  const { id: _id, ...doc } = updated;
  await getFirestore().collection(KINDS.RELATIONSHIP).doc(id).set(doc);
  return updated;
}

export async function deleteRelationship(userId: string | undefined, id: string): Promise<void> {
  const uid = requireUser(userId);
  await ownRelationship(id, uid);
  await getFirestore().collection(KINDS.RELATIONSHIP).doc(id).delete();
}
