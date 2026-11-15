import NextAuth from 'next-auth';
import { googleProvider } from '@/lib/google-provider';
import { secrets } from '@/lib/secrets';

// Auth configuration without database access, used by the proxy to read the session.
export const { auth: authMiddleware, handlers } = NextAuth({
  secret: secrets.authSecret,
  trustHost: true,
  providers: [googleProvider()],
  callbacks: {
    async session({ session, token }) {
      if (token?.sub) {
        session.user.id = token.sub;
      }
      return session;
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
