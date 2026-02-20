import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { KINDS, getEntity, saveEntity, deleteEntity } from '@/lib/datastore';
import type { Person, ApiResponse } from '@/types';
import { personSchema } from '@/types';

// GET /api/persons/[id] - Get a single person
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    const { id } = await params;

    const person = await getEntity<Person>(KINDS.PERSON, id);

    if (!person) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'Person not found' },
        { status: 404 }
      );
    }

    // Check privacy
    if (person.isPrivate && person.createdBy !== userId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'Person not found' },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse<Person>>({
      success: true,
      data: person,
    });
  } catch (error) {
    console.error('Error fetching person:', error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: 'Failed to fetch person' },
      { status: 500 }
    );
  }
}

// PUT /api/persons/[id] - Update a person
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const existingPerson = await getEntity<Person>(KINDS.PERSON, id);

    if (!existingPerson) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'Person not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (existingPerson.createdBy !== session.user.id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validationResult = personSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: validationResult.error.message },
        { status: 400 }
      );
    }

    const data = validationResult.data;
    const updatedPerson: Person = {
      ...existingPerson,
      name: data.name,
      courtesyName: data.courtesyName,
      artName: data.artName,
      gender: data.gender,
      birthYear: data.birthYear ?? null,
      birthMonth: data.birthMonth ?? null,
      birthDay: data.birthDay ?? null,
      deathYear: data.deathYear ?? null,
      deathMonth: data.deathMonth ?? null,
      deathDay: data.deathDay ?? null,
      avatar: data.avatar ?? null,
      isPrivate: data.isPrivate,
      updatedAt: new Date(),
    };

    await saveEntity(KINDS.PERSON, updatedPerson);

    return NextResponse.json<ApiResponse<Person>>({
      success: true,
      data: updatedPerson,
    });
  } catch (error) {
    console.error('Error updating person:', error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: 'Failed to update person' },
      { status: 500 }
    );
  }
}

// DELETE /api/persons/[id] - Delete a person
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const existingPerson = await getEntity<Person>(KINDS.PERSON, id);

    if (!existingPerson) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'Person not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (existingPerson.createdBy !== session.user.id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    await deleteEntity(KINDS.PERSON, id);

    return NextResponse.json<ApiResponse<never>>({
      success: true,
    });
  } catch (error) {
    console.error('Error deleting person:', error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: 'Failed to delete person' },
      { status: 500 }
    );
  }
}
