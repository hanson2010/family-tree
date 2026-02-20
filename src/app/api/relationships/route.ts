import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { KINDS, queryEntities, queryEntitiesByProperty, saveEntity } from '@/lib/firestore';
import type { Relationship, ApiResponse } from '@/types';
import { relationshipSchema, RelationshipType } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// GET /api/relationships - List all relationships
export async function GET(request: NextRequest) {
  try {
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

    const relationship: Relationship = {
      id: uuidv4(),
      personAId: data.personAId,
      personBId: data.personBId,
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

    // For SPOUSE relationships, create the bidirectional relationship
    // CONCUBINE remains unidirectional (personA is the master, personB is the concubine)
    if (data.type === RelationshipType.SPOUSE) {
      const reverseRelationship: Relationship = {
        id: uuidv4(),
        personAId: data.personBId,
        personBId: data.personAId,
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
      await saveEntity(KINDS.RELATIONSHIP, reverseRelationship);
    }

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
