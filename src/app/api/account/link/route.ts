import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { LINK_COOKIE, LINK_INTENT_SECONDS, createLinkIntent } from '@/lib/link-intent';
import type { ApiResponse } from '@/types';

// POST /api/account/link - Start linking another sign-in identity to the signed-in account: the
// next OAuth sign-in in this browser (within 10 minutes) is added to this account instead of
// signing in on its own. The client then calls signIn(provider).
export async function POST() {
  const session = await auth();
  const accountId = session?.user?.id;
  if (!accountId) return NextResponse.json<ApiResponse<never>>({ success: false, error: 'Unauthorized' }, { status: 401 });
  const response = NextResponse.json<ApiResponse<null>>({ success: true, data: null });
  response.cookies.set(LINK_COOKIE, createLinkIntent(accountId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // Sent on the provider's redirect back to the site, a top-level navigation
    sameSite: 'lax',
    path: '/',
    maxAge: LINK_INTENT_SECONDS,
  });
  return response;
}
