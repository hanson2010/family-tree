import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { errorResponse } from '@/lib/api-errors';
import { deleteSavedFace } from '@/lib/family-service';
import type { ApiResponse } from '@/types';

// DELETE /api/avatars/[id] - Remove a saved face, after it is used or when it is not wanted
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const { id } = await params;
    await deleteSavedFace(session?.user?.id, id);
    return NextResponse.json<ApiResponse<null>>({ success: true, data: null });
  } catch (error) {
    return errorResponse(error, 'Failed to delete avatar');
  }
}
