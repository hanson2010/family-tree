import GitHub from 'next-auth/providers/github';
import { googleProvider } from '@/lib/google-provider';
import { secrets } from '@/lib/secrets';

/** The sign-in providers, Google first; both are required */
export function authProviders() {
  return [
    googleProvider(),
    GitHub({ clientId: process.env.GITHUB_CLIENT_ID || '', clientSecret: secrets.githubClientSecret }),
  ];
}
