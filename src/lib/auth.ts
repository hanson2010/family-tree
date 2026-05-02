import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { KINDS, getEntity, saveEntity } from '@/lib/firestore';
import { secrets } from '@/lib/secrets';
import type { User } from '@/types';

// Full auth configuration with Datastore integration for API routes
// This runs in Node.js runtime (not Edge Runtime)
export const { handlers, signIn, signOut, auth } = NextAuth({
  
  secret: secrets.authSecret,
  // Required for proper host detection in development and behind proxies
  trustHost: true,
  providers: [
    GitHub({
      clientId: secrets.githubClientId,
      clientSecret: secrets.githubClientSecret,
      issuer: 'https://github.com',
      authorization: { params: { scope: 'read:user user:email' } },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'github') {
        try {
          // Check if user exists in Datastore
          const existingUser = await getEntity<User>(KINDS.USER, account.providerAccountId);

          if (!existingUser) {
            // Create new user
            const newUser: User = {
              id: account.providerAccountId,
              githubId: account.providerAccountId,
              email: user.email || null,
              name: user.name || null,
              avatarUrl: user.image || null,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            await saveEntity(KINDS.USER, newUser);
          } else {
            // Update existing user
            const updatedUser: User = {
              ...existingUser,
              email: user.email || null,
              name: user.name || null,
              avatarUrl: user.image || null,
              updatedAt: new Date(),
            };
            await saveEntity(KINDS.USER, updatedUser);
          }
        } catch (error) {
          console.error('Error saving user to Datastore:', error);
          // Allow sign in even if Datastore fails (for development without Datastore)
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
