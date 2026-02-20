import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { KINDS, saveEntity, queryEntities, queryEntitiesByProperty } from '@/lib/datastore';
import type { Person, ApiResponse } from '@/types';
import { personSchema } from '@/types';
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
    const validationResult = personSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: validationResult.error.message },
        { status: 400 }
      );
    }

    const data = validationResult.data;
    const userId = session.user.id;

    // Check for duplicate persons with the same name and birthday
    // Allow duplicates if the existing person is private and not owned by the current user
    const existingPersons = await queryEntitiesByProperty<Person>(KINDS.PERSON, 'name', data.name);
    const duplicatePerson = existingPersons.find(person => {
      // Check if birthday matches (both null or same values)
      const birthYearMatch = person.birthYear === (data.birthYear ?? null);
      const birthMonthMatch = person.birthMonth === (data.birthMonth ?? null);
      const birthDayMatch = person.birthDay === (data.birthDay ?? null);
      const birthdayMatch = birthYearMatch && birthMonthMatch && birthDayMatch;

      // If birthday matches, check if it's a visible duplicate
      if (birthdayMatch) {
        // Allow if the existing person is private and not owned by current user
        // (user can't see it, so they can create their own)
        if (person.isPrivate && person.createdBy !== userId) {
          return false;
        }
        return true;
      }
      return false;
    });

    if (duplicatePerson) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: 'A person with this name and birthday already exists. Please check if this is the same person.',
        },
        { status: 409 } // Conflict status code
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
      avatar: data.avatar ?? null,
      isPrivate: data.isPrivate,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    await saveEntity(KINDS.PERSON, person);

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
