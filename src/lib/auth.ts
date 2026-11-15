import NextAuth from 'next-auth';
import { KINDS, getEntity, saveEntity } from '@/lib/firestore';
import { googleProvider } from '@/lib/google-provider';
import { secrets } from '@/lib/secrets';
import type { User } from '@/types';

// Full auth configuration with Firestore integration for API routes
export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: secrets.authSecret,
  // Required for proper host detection in development and behind proxies
  trustHost: true,
  providers: [googleProvider()],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        try {
          // The Google account id is the user id
          const id = account.providerAccountId;
          const existingUser = await getEntity<User>(KINDS.USER, id);
          const now = new Date();

          await saveEntity(KINDS.USER, {
            ...existingUser,
            id,
            email: user.email || null,
            name: user.name || null,
            avatarUrl: user.image || null,
            createdAt: existingUser?.createdAt ?? now,
            updatedAt: now,
          } satisfies User);
        } catch (error) {
          console.error('Error saving user to Firestore:', error);
          // Allow sign in even if Firestore fails (for development without Firestore)
        }
      }
      return true;
    },
    async session({ session, token }) {
      if (token?.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, account }) {
      if (account) {
        token.sub = account.providerAccountId;
      }
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
