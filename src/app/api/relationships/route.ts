import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { KINDS, queryEntities, queryEntitiesByProperty, saveEntity, getEntity } from '@/lib/firestore';
import type { Relationship, ApiResponse, Person } from '@/types';
import { relationshipSchema } from '@/types';
import { ORDERED_MARRIAGE_TYPES, shouldSwapPartners } from '@/lib/relationship-direction';
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

    // Spouse and concubine are stored with the woman as person A
    let personAId = data.personAId;
    let personBId = data.personBId;
    if (ORDERED_MARRIAGE_TYPES.includes(data.type)) {
      const [personA, personB] = await Promise.all([
        getEntity<Person>(KINDS.PERSON, data.personAId),
        getEntity<Person>(KINDS.PERSON, data.personBId),
      ]);
      if (shouldSwapPartners(data.type, personA?.gender, personB?.gender)) {
        [personAId, personBId] = [personBId, personAId];
      }
    }

    // The same relationship between the same two persons is stored once: return the existing one.
    // "Add Family Relationships" sends the parents' marriage again with every child.
    const between = async (a: string, b: string) =>
      queryEntities<Relationship>(KINDS.RELATIONSHIP, [
        { property: 'personAId', operator: '==', value: a },
        { property: 'personBId', operator: '==', value: b },
      ]);
    const existing = [...(await between(personAId, personBId)), ...(await between(personBId, personAId))].find(
      (r) => r.type === data.type
    );
    if (existing) {
      return NextResponse.json<ApiResponse<Relationship>>({ success: true, data: existing }, { status: 200 });
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
