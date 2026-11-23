import NextAuth from 'next-auth';
import { cookies } from 'next/headers';
import { authProviders } from '@/lib/auth-providers';
import { secrets } from '@/lib/secrets';
import { githubVerifiedEmail, linkIdentity, signInAccount, type Provider, type SignInIdentity } from '@/lib/accounts';
import { LINK_COOKIE, verifyLinkIntent } from '@/lib/link-intent';

/** Where linking another sign-in method is started, and where its result is shown */
export const ACCOUNT_PAGE = '/account';

// Full auth configuration with Firestore integration for API routes
export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: secrets.authSecret,
  // Required for proper host detection in development and behind proxies
  trustHost: true,
  providers: authProviders(),
  callbacks: {
    /**
     * Resolve the Google or GitHub identity to its account (see accounts.ts) and keep the account
     * ID on `user` for the session. With a link intent from the account page, add the identity to
     * that account instead and return to the page, keeping the current session.
     */
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google' && account?.provider !== 'github') return true;
      try {
        const verifiedEmail =
          account.provider === 'google'
            ? profile?.email_verified
              ? (profile.email as string)
              : null
            : await githubVerifiedEmail(account.access_token);
        const identity: SignInIdentity = {
          provider: account.provider as Provider,
          providerAccountId: account.providerAccountId,
          name: user.name ?? null,
          image: user.image ?? null,
          verifiedEmail,
        };

        const jar = await cookies();
        const linkAccountId = verifyLinkIntent(jar.get(LINK_COOKIE)?.value);
        if (linkAccountId) {
          jar.delete(LINK_COOKIE);
          const outcome = await linkIdentity(identity, linkAccountId);
          return `${ACCOUNT_PAGE}?link=${outcome}&provider=${account.provider}`;
        }

        user.id = await signInAccount(identity);
        return true;
      } catch (error) {
        // Without the account store the identity cannot be matched to its account
        console.error('Error resolving the account for a sign-in:', error);
        return false;
      }
    },
    async session({ session, token }) {
      if (token?.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user, account }) {
      // On sign-in, the account ID found above
      if (account && user?.id) token.sub = user.id;
      return token;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
  },
});
