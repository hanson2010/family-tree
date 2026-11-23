import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { errorResponse } from '@/lib/api-errors';
import { unlinkIdentity } from '@/lib/accounts';
import type { ApiResponse } from '@/types';

// DELETE /api/account/identities/[id] - Remove a sign-in identity from the signed-in account; the
// last one cannot be removed
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const accountId = session?.user?.id;
    if (!accountId) return NextResponse.json<ApiResponse<never>>({ success: false, error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const outcome = await unlinkIdentity(accountId, decodeURIComponent(id));
    if (outcome === 'notFound') return NextResponse.json<ApiResponse<never>>({ success: false, error: 'Not found' }, { status: 404 });
    if (outcome === 'last') {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'This is the only way to sign in to this account.' },
        { status: 409 }
      );
    }
    return NextResponse.json<ApiResponse<null>>({ success: true, data: null });
  } catch (error) {
    return errorResponse(error, 'Failed to unlink the sign-in method');
  }
}
