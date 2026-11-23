import type { Transaction } from '@google-cloud/firestore';
import { KINDS, getFirestore, queryEntitiesByProperty } from '@/lib/firestore';
import type { User } from '@/types';

/**
 * Accounts and their sign-in identities. An account is the app's user: everything a user owns
 * (persons, relationships, saved faces, API tokens) records its account ID, which is the ID of its
 * `User` document. An identity is one Google or GitHub account and belongs to exactly one account;
 * an account may have several.
 *
 * Account IDs are random, except for users from before identities existed: their account ID is
 * their Google account ID, which their data already records, so nothing needs rewriting.
 *
 * Signing in (without a link intent) resolves the identity to an account:
 * 1. the account it belongs to;
 * 2. for Google, the account whose ID is the Google account ID (users from before identities);
 * 3. the one account with the same email verified by its provider, when this provider has verified
 *    the email too;
 * 4. otherwise a new account.
 * With a link intent (see link-intent.ts), the identity is added to the intent's account instead.
 */

const IDENTITIES = 'Identity';

export type Provider = 'google' | 'github';
export const PROVIDERS: Provider[] = ['google', 'github'];

export interface Identity {
  /** `${provider}:${providerAccountId}`, so an identity can belong to only one account */
  id: string;
  accountId: string;
  provider: Provider;
  providerAccountId: string;
  /** Lowercased; null when the provider has not verified it */
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  image: string | null;
  linkedAt: Date;
}

/** One sign-in, as the provider reports it */
export interface SignInIdentity {
  provider: Provider;
  providerAccountId: string;
  name: string | null;
  image: string | null;
  /** The email, only when the provider says it is verified */
  verifiedEmail: string | null;
}

export type LinkOutcome = 'linked' | 'already' | 'inUse';

const db = () => getFirestore();
const identityId = (provider: Provider, providerAccountId: string) => `${provider}:${providerAccountId}`;
const identityRef = (id: string) => db().collection(IDENTITIES).doc(id);
const accountRef = (accountId: string) => db().collection(KINDS.USER).doc(accountId);

function identityRecord(sign: SignInIdentity, accountId: string, linkedAt: Date): Omit<Identity, 'id'> {
  return {
    accountId,
    provider: sign.provider,
    providerAccountId: sign.providerAccountId,
    email: sign.verifiedEmail?.toLowerCase() ?? null,
    emailVerified: !!sign.verifiedEmail,
    name: sign.name,
    image: sign.image,
    linkedAt,
  };
}

/** Write the account document, keeping what it has and filling in name and picture */
function touchAccount(tx: Transaction, accountId: string, existing: Omit<User, 'id'> | undefined, sign: SignInIdentity) {
  const now = new Date();
  tx.set(accountRef(accountId), {
    ...existing,
    email: existing?.email ?? sign.verifiedEmail?.toLowerCase() ?? null,
    emailVerified: existing?.emailVerified ?? (existing?.email ? true : !!sign.verifiedEmail),
    name: existing?.name || sign.name,
    avatarUrl: existing?.avatarUrl || sign.image,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

/** The account an identity signs in to (see the order above), creating or joining one if needed */
export async function signInAccount(sign: SignInIdentity): Promise<string> {
  const id = identityId(sign.provider, sign.providerAccountId);
  const email = sign.verifiedEmail?.toLowerCase() ?? null;

  return db().runTransaction(async (tx) => {
    const identity = (await tx.get(identityRef(id))).data() as Omit<Identity, 'id'> | undefined;
    if (identity) {
      const account = (await tx.get(accountRef(identity.accountId))).data() as Omit<User, 'id'> | undefined;
      tx.set(identityRef(id), { ...identityRecord(sign, identity.accountId, identity.linkedAt) });
      touchAccount(tx, identity.accountId, account, sign);
      return identity.accountId;
    }

    let accountId: string | null = null;
    // Users from before identities: the account ID is the Google account ID
    if (sign.provider === 'google') {
      const legacy = await tx.get(accountRef(sign.providerAccountId));
      if (legacy.exists) accountId = sign.providerAccountId;
    }
    // The one account with the same verified email: on its identities, or (users from before
    // identities, whose email came from Google) on the account itself
    if (!accountId && email) {
      const sameEmail = await tx.get(
        db().collection(IDENTITIES).where('email', '==', email).where('emailVerified', '==', true)
      );
      const accounts = new Set(sameEmail.docs.map((d) => String(d.get('accountId'))));
      if (accounts.size === 0) {
        const legacyAccounts = await tx.get(db().collection(KINDS.USER).where('email', '==', email));
        legacyAccounts.docs.filter((d) => d.get('emailVerified') !== false).forEach((d) => accounts.add(d.id));
      }
      if (accounts.size === 1) accountId = [...accounts][0];
    }
    accountId ??= db().collection(KINDS.USER).doc().id;

    const account = (await tx.get(accountRef(accountId))).data() as Omit<User, 'id'> | undefined;
    tx.set(identityRef(id), identityRecord(sign, accountId, new Date()));
    touchAccount(tx, accountId, account, sign);
    return accountId;
  });
}

/** Add an identity to the account that asked to link it */
export async function linkIdentity(sign: SignInIdentity, accountId: string): Promise<LinkOutcome> {
  const id = identityId(sign.provider, sign.providerAccountId);
  return db().runTransaction(async (tx) => {
    const identity = (await tx.get(identityRef(id))).data() as Omit<Identity, 'id'> | undefined;
    if (identity) return identity.accountId === accountId ? 'already' : 'inUse';
    const account = (await tx.get(accountRef(accountId))).data() as Omit<User, 'id'> | undefined;
    tx.set(identityRef(id), identityRecord(sign, accountId, new Date()));
    touchAccount(tx, accountId, account, sign);
    return 'linked';
  });
}

/** The identities of an account, Google first */
export async function listIdentities(accountId: string): Promise<Identity[]> {
  const identities = await queryEntitiesByProperty<Identity>(IDENTITIES, 'accountId', accountId);
  return identities.sort((a, b) => PROVIDERS.indexOf(a.provider) - PROVIDERS.indexOf(b.provider));
}

/** Remove an identity from the account, which must keep at least one other way to sign in */
export async function unlinkIdentity(accountId: string, id: string): Promise<'unlinked' | 'notFound' | 'last'> {
  return db().runTransaction(async (tx) => {
    const identity = (await tx.get(identityRef(id))).data() as Omit<Identity, 'id'> | undefined;
    if (!identity || identity.accountId !== accountId) return 'notFound';
    const all = await tx.get(db().collection(IDENTITIES).where('accountId', '==', accountId));
    if (all.docs.length < 2) return 'last';
    tx.delete(identityRef(id));
    return 'unlinked';
  });
}

/** The verified primary email of a GitHub account, read with its access token (scope user:email) */
export async function githubVerifiedEmail(accessToken: string | undefined): Promise<string | null> {
  if (!accessToken) return null;
  try {
    const response = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json', 'User-Agent': 'family-tree' },
    });
    if (!response.ok) return null;
    const emails = (await response.json()) as { email: string; primary: boolean; verified: boolean }[];
    return emails.find((e) => e.primary && e.verified)?.email ?? null;
  } catch {
    return null;
  }
}
