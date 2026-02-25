import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { KINDS, queryEntities, queryEntitiesByProperty, saveEntity, getEntity } from '@/lib/firestore';
import type { Relationship, ApiResponse, Person } from '@/types';
import { relationshipSchema, RelationshipType, Gender } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// GET /api/relationships - List all relationships
// For anonymous users, only return relationships involving public persons
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    const searchParams = request.nextUrl.searchParams;
    const personId = searchParams.get('personId');

    let relationships: Relationship[];

    if (personId) {
      // Get relationships where person is involved
      const asA = await queryEntitiesByProperty<Relationship>(KINDS.RELATIONSHIP, 'personAId', personId);
      const asB = await queryEntitiesByProperty<Relationship>(KINDS.RELATIONSHIP, 'personBId', personId);
      relationships = [...asA, ...asB];
    } else {
      relationships = await queryEntities<Relationship>(KINDS.RELATIONSHIP);
    }

    // For anonymous users, filter relationships to only include those involving public persons
    if (!userId) {
      // Get all persons to check privacy
      const allPersons = await queryEntities<Person>(KINDS.PERSON);
      const publicPersonIds = new Set(
        allPersons.filter(p => !p.isPrivate).map(p => p.id)
      );

      // Only include relationships where both persons are public
      relationships = relationships.filter(rel =>
        publicPersonIds.has(rel.personAId) && publicPersonIds.has(rel.personBId)
      );
    }

    return NextResponse.json<ApiResponse<Relationship[]>>({
      success: true,
      data: relationships,
    });
  } catch (error) {
    console.error('Error fetching relationships:', error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: 'Failed to fetch relationships' },
      { status: 500 }
    );
  }
}

// POST /api/relationships - Create a new relationship
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
    const validationResult = relationshipSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: validationResult.error.message },
        { status: 400 }
      );
    }

    const data = validationResult.data;
    const now = new Date();

    // For SPOUSE relationships, normalize the order: female as A, male as B
    let personAId = data.personAId;
    let personBId = data.personBId;

    if (data.type === RelationshipType.SPOUSE) {
      // Fetch both persons to determine their genders
      const personA = await getEntity<Person>(KINDS.PERSON, data.personAId);
      const personB = await getEntity<Person>(KINDS.PERSON, data.personBId);

      if (personA && personB) {
        // Normalize: female as A, male as B
        // If both have same gender or unknown, keep original order
        if (personB.gender === Gender.FEMALE && personA.gender !== Gender.FEMALE) {
          personAId = data.personBId;
          personBId = data.personAId;
        } else if (personA.gender === Gender.MALE && personB.gender !== Gender.MALE) {
          personAId = data.personBId;
          personBId = data.personAId;
        }
      }
    }

    const relationship: Relationship = {
      id: uuidv4(),
      personAId,
      personBId,
      type: data.type,
      startYear: data.startYear ?? null,
      startMonth: data.startMonth ?? null,
      startDay: data.startDay ?? null,
      endYear: data.endYear ?? null,
      endMonth: data.endMonth ?? null,
      endDay: data.endDay ?? null,
      createdBy: session.user.id,
      createdAt: now,
      updatedAt: now,
    };

    await saveEntity(KINDS.RELATIONSHIP, relationship);

    return NextResponse.json<ApiResponse<Relationship>>(
      { success: true, data: relationship },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating relationship:', error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: 'Failed to create relationship' },
      { status: 500 }
    );
  }
}
