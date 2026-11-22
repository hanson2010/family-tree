import { createHash, randomBytes } from 'node:crypto';
import { KINDS, getEntity, getFirestore, queryEntitiesByProperty } from '@/lib/firestore';
import { ServiceError, setPersonAvatar } from '@/lib/family-service';
import type { Person } from '@/types';

/**
 * One-time avatar upload codes, so an agent can send a local image file with curl without the
 * image passing through the model: a code works for one person and one upload, for 10 minutes,
 * and contains no API token. Only a hash of each code is stored.
 */

const UPLOAD_TTL_MS = 10 * 60 * 1000;

interface StoredUpload {
  id: string;
  userId: string;
  personId: string;
  expiresAt: Date;
}

const hash = (code: string) => createHash('sha256').update(code).digest('hex');

const toMillis = (value: unknown) =>
  value instanceof Date ? value.getTime() : (value as { toMillis?: () => number })?.toMillis?.() ?? 0;

/** The public address of the site, for upload links */
export function siteUrl(): string {
  return (process.env.AUTH_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

/** A new upload code for one of the user's persons */
export async function createUploadCode(userId: string, personId: string): Promise<{ uploadUrl: string; expiresAt: string }> {
  const person = await getEntity<Person>(KINDS.PERSON, personId);
  if (!person || (person.isPrivate && person.createdBy !== userId)) throw new ServiceError(404, 'Person not found');
  if (person.createdBy !== userId) throw new ServiceError(403, 'Only the person’s creator can change them');

  const db = getFirestore();
  // Codes of this user that have expired are removed as new ones are made
  const stale = (await queryEntitiesByProperty<StoredUpload>(KINDS.AVATAR_UPLOAD, 'userId', userId)).filter(
    (u) => toMillis(u.expiresAt) < Date.now()
  );
  if (stale.length > 0) {
    const batch = db.batch();
    stale.forEach((u) => batch.delete(db.collection(KINDS.AVATAR_UPLOAD).doc(u.id)));
    await batch.commit();
  }

  const code = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + UPLOAD_TTL_MS);
  await db.collection(KINDS.AVATAR_UPLOAD).doc(hash(code)).set({ userId, personId, expiresAt });
  return { uploadUrl: `${siteUrl()}/api/avatar-upload/${code}`, expiresAt: expiresAt.toISOString() };
}

/**
 * Use an upload code: give its person an avatar from the image, then retire the code. An image
 * that cannot be read leaves the code usable until it expires.
 */
export async function useUploadCode(code: string, image: Buffer): Promise<Person> {
  const id = hash(code);
  const upload = await getEntity<StoredUpload>(KINDS.AVATAR_UPLOAD, id);
  if (!upload) throw new ServiceError(404, 'This upload link is not valid or was already used.');
  if (toMillis(upload.expiresAt) < Date.now()) {
    await getFirestore().collection(KINDS.AVATAR_UPLOAD).doc(id).delete();
    throw new ServiceError(410, 'This upload link has expired. Ask for a new one.');
  }
  const person = await setPersonAvatar(upload.userId, upload.personId, image);
  await getFirestore().collection(KINDS.AVATAR_UPLOAD).doc(id).delete();
  return person;
}
