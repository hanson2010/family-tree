import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { secrets } from '@/lib/secrets';

/**
 * The sign-in providers, Google first; both are required. Each redirects back to the Auth.js
 * default, `<site URL>/api/auth/callback/google` and `<site URL>/api/auth/callback/github`.
 */
export function authProviders() {
  return [
    Google({ clientId: process.env.GOOGLE_CLIENT_ID || '', clientSecret: secrets.googleClientSecret }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: secrets.githubClientSecret,
      // GitHub now names itself in the callback (`iss`, RFC 9207); Auth.js checks it against this
      issuer: 'https://github.com/login/oauth',
    }),
  ];
}
