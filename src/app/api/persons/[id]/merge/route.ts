import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { errorResponse } from '@/lib/api-errors';
import { mergePersons } from '@/lib/family-service';
import type { ApiResponse, Person } from '@/types';

const mergeSchema = z.object({
  /** The person merged into this one and then deleted */
  otherId: z.string().min(1),
  /** The merged person's details, as chosen field by field */
  person: z.unknown(),
  /** Whose avatar to keep */
  avatarFrom: z.enum(['this', 'other', 'none']),
});

// POST /api/persons/[id]/merge - Merge another person into this one, in one batch
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const { id } = await params;
    const parsed = mergeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json<ApiResponse<never>>({ success: false, error: parsed.error.message }, { status: 400 });
    }
    const { otherId, person, avatarFrom } = parsed.data;
    const merged = await mergePersons(session?.user?.id, id, otherId, person, avatarFrom);
    return NextResponse.json<ApiResponse<Person>>({ success: true, data: merged });
  } catch (error) {
    return errorResponse(error, 'Failed to merge persons');
  }
}
