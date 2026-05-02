import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { secrets } from '@/lib/secrets';

// Edge-compatible auth configuration (no Node.js dependencies)
// This is used by middleware which runs in Edge Runtime
export const { auth: authMiddleware, handlers } = NextAuth({
  secret: secrets.authSecret,
  trustHost: true,
  providers: [
    GitHub({
      clientId: secrets.githubClientId,
      clientSecret: secrets.githubClientSecret,
      issuer: 'https://github.com',
    }),
  ],
  callbacks: {
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
