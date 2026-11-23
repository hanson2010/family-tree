import { createHash, randomBytes } from 'node:crypto';
import { KINDS, getEntity, getFirestore, queryEntitiesByProperty } from '@/lib/firestore';
import { ServiceError, getVisiblePerson, saveFaceFromImage, setPersonAvatar } from '@/lib/family-service';
import type { Person, SavedAvatar } from '@/types';

/**
 * One-time upload codes, so an agent can send a local image file with curl without the image
 * passing through the model: a code is for one face photo, used as one person's avatar or saved
 * as a saved face, works for 10 minutes and contains no API token. Only a hash of each code is
 * stored.
 */

const UPLOAD_TTL_MS = 10 * 60 * 1000;

interface StoredUpload {
  id: string;
  userId: string;
  /** The person whose avatar is set; absent when the photo becomes a saved face */
  personId?: string | null;
  expiresAt: Date;
}

const hash = (code: string) => createHash('sha256').update(code).digest('hex');

const toMillis = (value: unknown) =>
  value instanceof Date ? value.getTime() : (value as { toMillis?: () => number })?.toMillis?.() ?? 0;

/** The public address of the site, for upload links */
export function siteUrl(): string {
  return (process.env.AUTH_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

/** A new upload code for an avatar of one of the user's persons, or for a saved face when `personId` is null */
export async function createUploadCode(
  userId: string,
  personId: string | null
): Promise<{ uploadUrl: string; expiresAt: string }> {
  if (personId) {
    const person = await getVisiblePerson(personId, userId);
    if (person.createdBy !== userId) throw new ServiceError(403, 'Only the person’s creator can change them');
  }

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
 * Use an upload code: give its person an avatar from the image, or save the image as a saved face,
 * then retire the code. An image that cannot be used leaves the code usable until it expires.
 */
export async function redeemUploadCode(code: string, image: Buffer): Promise<{ person: Person } | { face: SavedAvatar }> {
  const id = hash(code);
  const upload = await getEntity<StoredUpload>(KINDS.AVATAR_UPLOAD, id);
  if (!upload) throw new ServiceError(404, 'This upload link is not valid or was already used.');
  if (toMillis(upload.expiresAt) < Date.now()) {
    await getFirestore().collection(KINDS.AVATAR_UPLOAD).doc(id).delete();
    throw new ServiceError(410, 'This upload link has expired. Ask for a new one.');
  }
  const result = upload.personId
    ? { person: await setPersonAvatar(upload.userId, upload.personId, image) }
    : { face: await saveFaceFromImage(upload.userId, image) };
  await getFirestore().collection(KINDS.AVATAR_UPLOAD).doc(id).delete();
  return result;
}
