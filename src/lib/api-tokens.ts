import { createHash, randomBytes } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { KINDS, getEntity, getFirestore, queryEntitiesByProperty } from '@/lib/firestore';
import { ServiceError } from '@/lib/family-service';

/**
 * Personal access tokens: an MCP client sends one as `Authorization: Bearer <token>` and acts as
 * the token's owner. Only a SHA-256 hash of each token is stored; the token itself is shown once.
 */

const TOKEN_PREFIX = 'ft_';
const MAX_TOKENS_PER_USER = 10;
/** "Last used" is written at most this often per token, to keep writes down */
const LAST_USED_RESOLUTION_MS = 10 * 60 * 1000;

interface StoredToken {
  id: string;
  userId: string;
  name: string;
  tokenHash: string;
  /** The first characters of the token, to recognise it in the list */
  prefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

/** A token as shown in the token list: never the token or its hash */
export interface ApiTokenInfo {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

const toDate = (value: unknown): Date | null => {
  if (value == null) return null;
  if (value instanceof Date) return value;
  const timestamp = value as { toDate?: () => Date };
  return typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(String(value));
};

const toInfo = (t: StoredToken): ApiTokenInfo => ({
  id: t.id,
  name: t.name,
  prefix: t.prefix,
  createdAt: toDate(t.createdAt)!.toISOString(),
  lastUsedAt: toDate(t.lastUsedAt)?.toISOString() ?? null,
});

export async function listTokens(userId: string): Promise<ApiTokenInfo[]> {
  const tokens = await queryEntitiesByProperty<StoredToken>(KINDS.API_TOKEN, 'userId', userId);
  return tokens.map(toInfo).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** A new token for the user; the returned `token` is the only time it is available */
export async function createToken(userId: string, name: string): Promise<{ token: string; info: ApiTokenInfo }> {
  const label = name.trim().slice(0, 60);
  if (!label) throw new ServiceError(400, 'Give the token a name.');
  const existing = await queryEntitiesByProperty<StoredToken>(KINDS.API_TOKEN, 'userId', userId);
  if (existing.length >= MAX_TOKENS_PER_USER) {
    throw new ServiceError(400, `At most ${MAX_TOKENS_PER_USER} tokens; revoke one first.`);
  }

  const token = TOKEN_PREFIX + randomBytes(32).toString('base64url');
  const stored: StoredToken = {
    id: uuidv4(),
    userId,
    name: label,
    tokenHash: hash(token),
    prefix: token.slice(0, TOKEN_PREFIX.length + 6),
    createdAt: new Date(),
    lastUsedAt: null,
  };
  const { id, ...doc } = stored;
  await getFirestore().collection(KINDS.API_TOKEN).doc(id).set(doc);
  return { token, info: toInfo(stored) };
}

export async function revokeToken(userId: string, id: string): Promise<void> {
  const token = await getEntity<StoredToken>(KINDS.API_TOKEN, id);
  // Another user's token is reported as missing, so its existence is not revealed
  if (!token || token.userId !== userId) throw new ServiceError(404, 'Token not found');
  await getFirestore().collection(KINDS.API_TOKEN).doc(id).delete();
}

/** The owner of a valid token, or null; records when the token was last used */
export async function verifyToken(token: string): Promise<{ userId: string; tokenId: string } | null> {
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  const [stored] = await queryEntitiesByProperty<StoredToken>(KINDS.API_TOKEN, 'tokenHash', hash(token));
  if (!stored) return null;
  const lastUsed = toDate(stored.lastUsedAt);
  if (!lastUsed || Date.now() - lastUsed.getTime() > LAST_USED_RESOLUTION_MS) {
    await getFirestore().collection(KINDS.API_TOKEN).doc(stored.id).update({ lastUsedAt: new Date() });
  }
  return { userId: stored.userId, tokenId: stored.id };
}
