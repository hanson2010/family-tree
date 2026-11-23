import { customFetch } from 'next-auth';
import Google from 'next-auth/providers/google';
import { secrets } from '@/lib/secrets';

/** Path Google redirects back to after sign-in; register `<site URL>/auth/callback` on the OAuth client. */
export const GOOGLE_CALLBACK_PATH = '/auth/callback';

function redirectUri(): string {
  const siteUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  return new URL(GOOGLE_CALLBACK_PATH, siteUrl).toString();
}

/**
 * Google provider that uses `/auth/callback` as its redirect URI instead of the
 * Auth.js default (`/api/auth/callback/google`). The same URI has to be sent in
 * the authorization request and in the code-for-token exchange.
 */
export function googleProvider() {
  const redirect_uri = redirectUri();

  return Google({
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: secrets.googleClientSecret,
    authorization: { params: { redirect_uri } },
    [customFetch]: (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      if (init?.body instanceof URLSearchParams && init.body.has('redirect_uri')) {
        init.body.set('redirect_uri', redirect_uri);
      }
      return fetch(input, init);
    },
  });
}
