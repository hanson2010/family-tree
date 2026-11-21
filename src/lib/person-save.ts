import { z } from 'zod';
import { KINDS, getEntity, getFirestore } from '@/lib/firestore';
import type { Person, SavedAvatar } from '@/types';
import { personSchema } from '@/types';

/** A person from the form, optionally using one of the user's saved faces as the avatar */
export const personRequestSchema = personSchema.extend({ savedAvatarId: z.string().min(1).optional() });

/** The user's saved face with this id, or null when it is missing or someone else's */
export async function findOwnSavedAvatar(id: string, userId: string): Promise<SavedAvatar | null> {
  const avatar = await getEntity<SavedAvatar>(KINDS.AVATAR, id);
  return avatar && avatar.createdBy === userId ? avatar : null;
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
