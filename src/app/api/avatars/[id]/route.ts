import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { KINDS, deleteEntity, getEntity } from '@/lib/firestore';
import type { ApiResponse, SavedAvatar } from '@/types';

const fail = (error: string, status: number) => NextResponse.json<ApiResponse<never>>({ success: false, error }, { status });

// DELETE /api/avatars/[id] - Remove a saved face, after it is used or when it is not wanted
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return fail('Unauthorized', 401);

    const { id } = await params;
    const avatar = await getEntity<SavedAvatar>(KINDS.AVATAR, id);
    // Another user's face is reported as missing, so its existence is not revealed
    if (!avatar || avatar.createdBy !== userId) return fail('Not found', 404);

    await deleteEntity(KINDS.AVATAR, id);
    return NextResponse.json<ApiResponse<null>>({ success: true, data: null });
  } catch (error) {
    console.error('Error deleting saved avatar:', error);
    return fail('Failed to delete avatar', 500);
  }
}
