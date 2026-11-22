import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createPerson, listVisiblePersons } from '@/lib/family-service';
import { errorResponse } from '@/lib/api-errors';
import type { ApiResponse, Person } from '@/types';

// GET /api/persons - Persons the user can see (public ones for anonymous users)
export async function GET() {
  try {
    const session = await auth();
    return NextResponse.json<ApiResponse<Person[]>>({ success: true, data: await listVisiblePersons(session?.user?.id) });
  } catch (error) {
    return errorResponse(error, 'Failed to fetch persons');
  }
}

// POST /api/persons - Create a person (refused when it duplicates a public one)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const person = await createPerson(session?.user?.id, await request.json());
    return NextResponse.json<ApiResponse<Person>>({ success: true, data: person }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Failed to create person');
  }
}
