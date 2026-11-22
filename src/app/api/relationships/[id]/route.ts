import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { KINDS, getEntity, saveEntity, deleteEntity, queryEntities, queryEntitiesByProperty } from '@/lib/firestore';
import type { Relationship, ApiResponse, Person } from '@/types';
import { relationshipSchema } from '@/types';
import { ORDERED_MARRIAGE_TYPES, shouldSwapPartners } from '@/lib/relationship-direction';

// GET /api/relationships/[id] - Get a single relationship
// Anonymous users can only access relationships between public persons
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    const { id } = await params;
    const relationship = await getEntity<Relationship>(KINDS.RELATIONSHIP, id);

    if (!relationship) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'Relationship not found' },
        { status: 404 }
      );
    }

    // For anonymous users, check if both persons in the relationship are public
    if (!userId) {
      const personA = await getEntity<Person>(KINDS.PERSON, relationship.personAId);
      const personB = await getEntity<Person>(KINDS.PERSON, relationship.personBId);

      if (!personA || !personB || personA.isPrivate || personB.isPrivate) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: 'Relationship not found' },
          { status: 404 }
        );
      }
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

    // Spouse and concubine are stored with the woman as person A, also after a change of type
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

    // A changed type must not duplicate another relationship between the same two persons
    const between = async (a: string, b: string) =>
      queryEntities<Relationship>(KINDS.RELATIONSHIP, [
        { property: 'personAId', operator: '==', value: a },
        { property: 'personBId', operator: '==', value: b },
      ]);
    const duplicate = [...(await between(personAId, personBId)), ...(await between(personBId, personAId))].find(
      (r) => r.id !== id && r.type === data.type
    );
    if (duplicate) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'These two persons already have this relationship.' },
        { status: 409 }
      );
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
