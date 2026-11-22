import { z } from 'zod';
import { KINDS, getEntity, getFirestore, queryEntitiesByProperty } from '@/lib/firestore';
import { ORDERED_MARRIAGE_TYPES, shouldSwapPartners } from '@/lib/relationship-direction';
import type { Gender, Person, Relationship, SavedAvatar } from '@/types';
import { personSchema } from '@/types';

/** A person from the form, optionally using one of the user's saved faces as the avatar */
export const personRequestSchema = personSchema.extend({ savedAvatarId: z.string().min(1).optional() });

/** The user's saved face with this id, or null when it is missing or someone else's */
export async function findOwnSavedAvatar(id: string, userId: string): Promise<SavedAvatar | null> {
  const avatar = await getEntity<SavedAvatar>(KINDS.AVATAR, id);
  return avatar && avatar.createdBy === userId ? avatar : null;
}

/**
 * Put the woman first (person A) in each spouse and concubine relationship of a person whose
 * gender is `gender`, as all marriages are stored. Same-sex and unknown-gender pairs keep their order.
 */
export async function reorderMarriages(personId: string, gender: Gender): Promise<void> {
  const marriages = [
    ...(await queryEntitiesByProperty<Relationship>(KINDS.RELATIONSHIP, 'personAId', personId)),
    ...(await queryEntitiesByProperty<Relationship>(KINDS.RELATIONSHIP, 'personBId', personId)),
  ].filter((r) => ORDERED_MARRIAGE_TYPES.includes(r.type));
  const db = getFirestore();
  const batch = db.batch();
  let changes = 0;
  for (const r of marriages) {
    const partnerId = r.personAId === personId ? r.personBId : r.personAId;
    const partner = await getEntity<Person>(KINDS.PERSON, partnerId);
    const genderA = r.personAId === personId ? gender : partner?.gender;
    const genderB = r.personBId === personId ? gender : partner?.gender;
    if (shouldSwapPartners(r.type, genderA, genderB)) {
      batch.update(db.collection(KINDS.RELATIONSHIP).doc(r.id), { personAId: r.personBId, personBId: r.personAId });
      changes++;
    }
  }
  if (changes > 0) await batch.commit();
}

/**
 * Save the person and, when they use a saved face, delete that face in the same batch. The
 * batch fails, saving nothing, when the face no longer exists (e.g. it was just used elsewhere).
 */
export async function savePerson(person: Person, usedAvatarId?: string): Promise<void> {
  const db = getFirestore();
  const batch = db.batch();
  const { id, ...data } = person;
  batch.set(db.collection(KINDS.PERSON).doc(id), data);
  if (usedAvatarId) batch.delete(db.collection(KINDS.AVATAR).doc(usedAvatarId), { exists: true });
  await batch.commit();
}
