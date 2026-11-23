import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { secrets } from '@/lib/secrets';

/**
 * Marks that the signed-in account asked to link another sign-in identity, so the next OAuth
 * sign-in in this browser is linked to that account instead of signing in on its own. Without
 * it, signing in while signed in simply switches accounts and never links anything.
 */
export const LINK_COOKIE = 'family-tree-link';
export const LINK_INTENT_SECONDS = 10 * 60;

type Intent = { accountId: string; exp: number; nonce: string };

function sign(payload: string): string {
  return createHmac('sha256', `link-intent:${secrets.authSecret}`).update(payload).digest('base64url');
}

export function createLinkIntent(accountId: string, now = Date.now()): string {
  const intent: Intent = { accountId, exp: now + LINK_INTENT_SECONDS * 1000, nonce: randomBytes(12).toString('base64url') };
  const payload = Buffer.from(JSON.stringify(intent)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** The account ID of a valid, unexpired intent, or null */
export function verifyLinkIntent(value: string | undefined, now = Date.now()): string | null {
  if (!value) return null;
  const [payload, signature] = value.split('.');
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const intent = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Intent;
    return typeof intent.accountId === 'string' && intent.exp > now ? intent.accountId : null;
  } catch {
    return null;
  }
}
