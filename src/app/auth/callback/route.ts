import { NextRequest } from 'next/server';
import { handlers } from '@/lib/auth';

// Google redirects here after sign-in; hand the request to the Auth.js callback handler.
export function GET(request: NextRequest) {
  const url = new URL(request.url);
  url.pathname = '/api/auth/callback/google';
  return handlers.GET(new NextRequest(url, { headers: request.headers }));
}
