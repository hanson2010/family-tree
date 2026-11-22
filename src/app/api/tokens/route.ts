import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { createToken, listTokens, type ApiTokenInfo } from '@/lib/api-tokens';
import { errorResponse } from '@/lib/api-errors';
import type { ApiResponse } from '@/types';

// Tokens are managed only with a signed-in session, never with a token itself

// GET /api/tokens - The user's tokens, without the tokens themselves
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json<ApiResponse<never>>({ success: false, error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json<ApiResponse<ApiTokenInfo[]>>({ success: true, data: await listTokens(session.user.id) });
  } catch (error) {
    return errorResponse(error, 'Failed to list tokens');
  }
}

// POST /api/tokens - Create a token; the response is the only time the token is shown
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json<ApiResponse<never>>({ success: false, error: 'Unauthorized' }, { status: 401 });
    const parsed = z.object({ name: z.string() }).safeParse(await request.json());
    if (!parsed.success) return NextResponse.json<ApiResponse<never>>({ success: false, error: 'Give the token a name.' }, { status: 400 });
    const created = await createToken(session.user.id, parsed.data.name);
    return NextResponse.json<ApiResponse<{ token: string; info: ApiTokenInfo }>>({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Failed to create token');
  }
}
