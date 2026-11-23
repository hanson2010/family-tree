import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { errorResponse } from '@/lib/api-errors';
import { listSavedFaces, saveFaces } from '@/lib/family-service';
import { normalizeAvatar } from '@/lib/faces';
import type { ApiResponse, SavedAvatar } from '@/types';

const MAX_PER_REQUEST = 30;

const fail = (error: string, status: number) => NextResponse.json<ApiResponse<never>>({ success: false, error }, { status });

const saveSchema = z.object({ images: z.array(z.string()).min(1).max(MAX_PER_REQUEST) });

const toDate = (value: unknown) =>
  value instanceof Date ? value : typeof (value as { toDate?: () => Date })?.toDate === 'function' ? (value as { toDate: () => Date }).toDate() : new Date(String(value));

// GET /api/avatars - The signed-in user's saved faces, newest first
export async function GET() {
  try {
    const session = await auth();
    const avatars = (await listSavedFaces(session?.user?.id)).map((a) => ({ ...a, createdAt: toDate(a.createdAt) }));
    return NextResponse.json<ApiResponse<SavedAvatar[]>>({ success: true, data: avatars });
  } catch (error) {
    return errorResponse(error, 'Failed to fetch saved avatars');
  }
}

// POST /api/avatars - Save faces for later; each image is re-encoded on the server
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return fail('Unauthorized', 401);

    const parsed = saveSchema.safeParse(await request.json());
    if (!parsed.success) return fail(`Send 1 to ${MAX_PER_REQUEST} images.`, 400);

    let images: string[];
    try {
      images = await Promise.all(parsed.data.images.map(normalizeAvatar));
    } catch {
      return fail('An image could not be read.', 400);
    }
    const avatars = await saveFaces(session.user.id, images);
    return NextResponse.json<ApiResponse<SavedAvatar[]>>({ success: true, data: avatars }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Failed to save avatars');
  }
}
