import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { KINDS, getEntity, saveEntity, deleteEntity, queryEntitiesByProperty } from '@/lib/firestore';
import type { Relationship, ApiResponse, Person } from '@/types';
import { relationshipSchema, RelationshipType, Gender } from '@/types';

// GET /api/relationships/[id] - Get a single relationship
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const relationship = await getEntity<Relationship>(KINDS.RELATIONSHIP, id);

    if (!relationship) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'Relationship not found' },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse<Relationship>>({
      success: true,
      data: relationship,
    });
  } catch (error) {
    console.error('Error fetching relationship:', error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: 'Failed to fetch relationship' },
      { status: 500 }
    );
  }
}

// PUT /api/relationships/[id] - Update a relationship
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

    const existingRelationship = await getEntity<Relationship>(KINDS.RELATIONSHIP, id);

    if (!existingRelationship) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'Relationship not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (existingRelationship.createdBy !== session.user.id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'Forbidden' },
        { status: 403 }
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

    // For SPOUSE relationships, normalize the order: female as A, male as B
    let personAId = data.personAId;
    let personBId = data.personBId;

    if (data.type === RelationshipType.SPOUSE) {
      const personA = await getEntity<Person>(KINDS.PERSON, data.personAId);
      const personB = await getEntity<Person>(KINDS.PERSON, data.personBId);

      if (personA && personB) {
        // Normalize: female as A, male as B
        if (personB.gender === Gender.FEMALE && personA.gender !== Gender.FEMALE) {
          personAId = data.personBId;
          personBId = data.personAId;
        } else if (personA.gender === Gender.MALE && personB.gender !== Gender.MALE) {
          personAId = data.personBId;
          personBId = data.personAId;
        }
      }
    }

    const updatedRelationship: Relationship = {
      ...existingRelationship,
      personAId,
      personBId,
      type: data.type,
      startYear: data.startYear ?? null,
      startMonth: data.startMonth ?? null,
      startDay: data.startDay ?? null,
      endYear: data.endYear ?? null,
      endMonth: data.endMonth ?? null,
      endDay: data.endDay ?? null,
      updatedAt: new Date(),
    };

    await saveEntity(KINDS.RELATIONSHIP, updatedRelationship);

    return NextResponse.json<ApiResponse<Relationship>>({
      success: true,
      data: updatedRelationship,
    });
  } catch (error) {
    console.error('Error updating relationship:', error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: 'Failed to update relationship' },
      { status: 500 }
    );
  }
}

// DELETE /api/relationships/[id] - Delete a relationship
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

    const existingRelationship = await getEntity<Relationship>(KINDS.RELATIONSHIP, id);

    if (!existingRelationship) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'Relationship not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (existingRelationship.createdBy !== session.user.id) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    await deleteEntity(KINDS.RELATIONSHIP, id);

    return NextResponse.json<ApiResponse<never>>({
      success: true,
    });
  } catch (error) {
    console.error('Error deleting relationship:', error);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: 'Failed to delete relationship' },
      { status: 500 }
    );
  }
}
