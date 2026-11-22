import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { KINDS, queryEntities } from '@/lib/firestore';
import { describe, findVisibleDuplicate } from '@/lib/person-duplicates';
import { findOwnSavedAvatar, personRequestSchema, savePerson } from '@/lib/person-save';
import type { Person, ApiResponse } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// GET /api/persons - List all persons (public persons for anonymous users)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    const persons = await queryEntities<Person>(KINDS.PERSON);

    // Filter private persons for non-owners (anonymous users only see public persons)
    const filteredPersons = persons.filter(person => {
      if (!person.isPrivate) return true;
      return person.createdBy === userId;
    });

    return NextResponse.json<ApiResponse<Person[]>>({
      success: true,
      data: filteredPersons,
    });
  } catch (error) {
    console.error('Error fetching persons:', error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: 'Failed to fetch persons' },
      { status: 500 }
    );
  }
}

// POST /api/persons - Create a new person (with duplicate check)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validationResult = personRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: validationResult.error.message },
        { status: 400 }
      );
    }

    const data = validationResult.data;
    const userId = session.user.id;

    // A public person must not duplicate one already in the tree
    const duplicate = data.isPrivate ? null : await findVisibleDuplicate(data, userId);
    if (duplicate) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Already in the tree: ${describe(duplicate)}. This looks like the same person.` },
        { status: 409 }
      );
    }

    // A saved face is used as stored, not as sent by the browser
    const savedAvatar = data.savedAvatarId ? await findOwnSavedAvatar(data.savedAvatarId, userId) : null;
    if (data.savedAvatarId && !savedAvatar) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'The saved face is no longer available.' },
        { status: 409 }
      );
    }

    const now = new Date();

    const person: Person = {
      id: uuidv4(),
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
      avatar: savedAvatar?.image ?? data.avatar ?? null,
      isPrivate: data.isPrivate,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    await savePerson(person, savedAvatar?.id);

    return NextResponse.json<ApiResponse<Person>>(
      { success: true, data: person },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating person:', error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: 'Failed to create person' },
      { status: 500 }
    );
  }
}
