import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { deletePerson, getVisiblePerson, updatePerson } from '@/lib/family-service';
import { errorResponse } from '@/lib/api-errors';
import type { ApiResponse, Person } from '@/types';

type Params = { params: Promise<{ id: string }> };

// GET /api/persons/[id] - One person, if the user can see them
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    const { id } = await params;
    return NextResponse.json<ApiResponse<Person>>({ success: true, data: await getVisiblePerson(id, session?.user?.id) });
  } catch (error) {
    return errorResponse(error, 'Failed to fetch person');
  }
}

// PUT /api/persons/[id] - Update one of the user's persons
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    const { id } = await params;
    const person = await updatePerson(session?.user?.id, id, await request.json());
    return NextResponse.json<ApiResponse<Person>>({ success: true, data: person });
  } catch (error) {
    return errorResponse(error, 'Failed to update person');
  }
}

// DELETE /api/persons/[id] - Delete one of the user's persons and their relationships
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    const { id } = await params;
    await deletePerson(session?.user?.id, id);
    return NextResponse.json<ApiResponse<never>>({ success: true });
  } catch (error) {
    return errorResponse(error, 'Failed to delete person');
  }
}
