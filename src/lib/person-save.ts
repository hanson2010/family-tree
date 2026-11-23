import { z } from 'zod';
import { KINDS, getEntity } from '@/lib/firestore';
import type { SavedAvatar } from '@/types';
import { personSchema } from '@/types';

/** A person from the form, optionally using one of the user's saved faces as the avatar */
export const personRequestSchema = personSchema.extend({ savedAvatarId: z.string().min(1).optional() });

/** The user's saved face with this id, or null when it is missing or someone else's */
export async function findOwnSavedAvatar(id: string, userId: string): Promise<SavedAvatar | null> {
  const avatar = await getEntity<SavedAvatar>(KINDS.AVATAR, id);
  return avatar && avatar.createdBy === userId ? avatar : null;
}
