import { authMiddleware } from '@/lib/auth.config';
import { NextResponse } from 'next/server';

export default authMiddleware((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  // Public routes that don't require authentication
  const publicRoutes = ['/auth/signin', '/auth/error', '/api/auth'];
  const isPublicRoute = publicRoutes.some(route =>
    nextUrl.pathname.startsWith(route)
  );

  // API routes that should be protected
  const protectedApiRoutes = ['/api/persons', '/api/relationships', '/api/avatar'];
  const isProtectedApiRoute = protectedApiRoutes.some(route =>
    nextUrl.pathname.startsWith(route)
  );

  // Allow public routes
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Redirect to signin if not logged in and trying to access protected routes
  if (!isLoggedIn && (nextUrl.pathname.startsWith('/api') || nextUrl.pathname === '/')) {
    if (isProtectedApiRoute) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (nextUrl.pathname === '/') {
      return NextResponse.redirect(new URL('/auth/signin', nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
