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

  // Allow public routes
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Allow anonymous users to browse the main page and view public data
  // The API routes will filter data based on authentication status
  if (nextUrl.pathname === '/') {
    return NextResponse.next();
  }

  // API routes that require write operations (POST, PUT, DELETE) need authentication
  // GET requests are allowed for anonymous users - the API will filter data accordingly
  if (nextUrl.pathname.startsWith('/api/')) {
    const method = req.method;
    if (method !== 'GET' && !isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
