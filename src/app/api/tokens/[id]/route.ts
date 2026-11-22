import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { revokeToken } from '@/lib/api-tokens';
import { errorResponse } from '@/lib/api-errors';
import type { ApiResponse } from '@/types';

// DELETE /api/tokens/[id] - Revoke one of the user's tokens; it stops working at once
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json<ApiResponse<never>>({ success: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    await revokeToken(session.user.id, id);
    return NextResponse.json<ApiResponse<never>>({ success: true });
  } catch (error) {
    return errorResponse(error, 'Failed to revoke token');
  }
}
