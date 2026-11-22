import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { deleteRelationship, getVisibleRelationship, updateRelationship } from '@/lib/family-service';
import { errorResponse } from '@/lib/api-errors';
import type { ApiResponse, Relationship } from '@/types';

type Params = { params: Promise<{ id: string }> };

// GET /api/relationships/[id] - One relationship, if the user can see both persons
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    const { id } = await params;
    const relationship = await getVisibleRelationship(id, session?.user?.id);
    return NextResponse.json<ApiResponse<Relationship>>({ success: true, data: relationship });
  } catch (error) {
    return errorResponse(error, 'Failed to fetch relationship');
  }
}

// PUT /api/relationships/[id] - Update one of the user's relationships
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    const { id } = await params;
    const relationship = await updateRelationship(session?.user?.id, id, await request.json());
    return NextResponse.json<ApiResponse<Relationship>>({ success: true, data: relationship });
  } catch (error) {
    return errorResponse(error, 'Failed to update relationship');
  }
}

// DELETE /api/relationships/[id] - Delete one of the user's relationships
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    const { id } = await params;
    await deleteRelationship(session?.user?.id, id);
    return NextResponse.json<ApiResponse<never>>({ success: true });
  } catch (error) {
    return errorResponse(error, 'Failed to delete relationship');
  }
}
