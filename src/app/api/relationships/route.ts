import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createRelationship, listVisibleRelationships } from '@/lib/family-service';
import { errorResponse } from '@/lib/api-errors';
import type { ApiResponse, Relationship } from '@/types';

// GET /api/relationships[?personId=] - Relationships between persons the user can see
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const personId = request.nextUrl.searchParams.get('personId') ?? undefined;
    const relationships = await listVisibleRelationships(session?.user?.id, personId);
    return NextResponse.json<ApiResponse<Relationship[]>>({ success: true, data: relationships });
  } catch (error) {
    return errorResponse(error, 'Failed to fetch relationships');
  }
}

// POST /api/relationships - Create a relationship, or return the same one if it exists
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const { relationship, existed } = await createRelationship(session?.user?.id, await request.json());
    return NextResponse.json<ApiResponse<Relationship>>(
      { success: true, data: relationship },
      { status: existed ? 200 : 201 }
    );
  } catch (error) {
    return errorResponse(error, 'Failed to create relationship');
  }
}
