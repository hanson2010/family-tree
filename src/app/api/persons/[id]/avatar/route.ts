import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { errorResponse } from '@/lib/api-errors';
import { getPersonAvatar } from '@/lib/family-service';

// GET /api/persons/[id]/avatar?v=… - The avatar image of a person the user can see. The address
// changes with the image (v is its version), so browsers may keep it for good; only in their
// own cache, as a person can later become private.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const { id } = await params;
    const { image } = await getPersonAvatar(id, session?.user?.id);
    const match = image && /^data:([^;]+);base64,(.*)$/.exec(image);
    if (!match) return NextResponse.json({ success: false, error: 'No avatar' }, { status: 404 });
    return new NextResponse(new Uint8Array(Buffer.from(match[2], 'base64')), {
      headers: { 'Content-Type': match[1], 'Cache-Control': 'private, max-age=31536000, immutable' },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to fetch the avatar');
  }
}
