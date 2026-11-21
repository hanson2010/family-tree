import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { KINDS, getFirestore, queryEntitiesByProperty } from '@/lib/firestore';
import { normalizeAvatar } from '@/lib/faces';
import type { ApiResponse, SavedAvatar } from '@/types';

const MAX_PER_REQUEST = 30;
const MAX_PER_USER = 500;

const fail = (error: string, status: number) => NextResponse.json<ApiResponse<never>>({ success: false, error }, { status });

const saveSchema = z.object({ images: z.array(z.string()).min(1).max(MAX_PER_REQUEST) });

const toDate = (value: unknown) =>
  value instanceof Date ? value : typeof (value as { toDate?: () => Date })?.toDate === 'function' ? (value as { toDate: () => Date }).toDate() : new Date(String(value));

// GET /api/avatars - The signed-in user's saved faces, newest first
export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return fail('Unauthorized', 401);

    const avatars = (await queryEntitiesByProperty<SavedAvatar>(KINDS.AVATAR, 'createdBy', userId))
      .map((a) => ({ ...a, createdAt: toDate(a.createdAt) }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return NextResponse.json<ApiResponse<SavedAvatar[]>>({ success: true, data: avatars });
  } catch (error) {
    console.error('Error fetching saved avatars:', error);
    return fail('Failed to fetch saved avatars', 500);
  }
}

// POST /api/avatars - Save faces for later; each image is re-encoded on the server
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return fail('Unauthorized', 401);

    const parsed = saveSchema.safeParse(await request.json());
    if (!parsed.success) return fail(`Send 1 to ${MAX_PER_REQUEST} images.`, 400);

    const existing = await queryEntitiesByProperty<SavedAvatar>(KINDS.AVATAR, 'createdBy', userId);
    if (existing.length + parsed.data.images.length > MAX_PER_USER) {
      return fail(`At most ${MAX_PER_USER} saved faces; use or delete some first.`, 400);
    }

    let images: string[];
    try {
      images = await Promise.all(parsed.data.images.map(normalizeAvatar));
    } catch {
      return fail('An image could not be read.', 400);
    }

    const now = new Date();
    const avatars: SavedAvatar[] = images.map((image) => ({ id: uuidv4(), image, createdBy: userId, createdAt: now }));
    const db = getFirestore();
    const batch = db.batch();
    avatars.forEach(({ id, ...data }) => batch.set(db.collection(KINDS.AVATAR).doc(id), data));
    await batch.commit();

    return NextResponse.json<ApiResponse<SavedAvatar[]>>({ success: true, data: avatars }, { status: 201 });
  } catch (error) {
    console.error('Error saving avatars:', error);
    return fail('Failed to save avatars', 500);
  }
}
