import { NextRequest, NextResponse } from 'next/server';
import { redeemUploadCode } from '@/lib/avatar-uploads';
import { errorResponse } from '@/lib/api-errors';
import type { ApiResponse } from '@/types';

// POST /api/avatar-upload/[code] - Set a person's avatar, or save a saved face, from a file sent
// with curl (-F file=@photo.jpg). The one-time code from the MCP tool create_photo_upload_link is the
// only authorization needed.
export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const file = (await request.formData()).get('file');
    if (!(file instanceof File)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'Send the image as the form field "file", e.g. curl -F file=@photo.jpg …' },
        { status: 400 }
      );
    }
    const result = await redeemUploadCode(code, Buffer.from(await file.arrayBuffer()));
    const data =
      'person' in result ? { person: result.person.name } : { savedFace: result.face.id };
    return NextResponse.json<ApiResponse<typeof data>>({ success: true, data });
  } catch (error) {
    return errorResponse(error, 'Failed to upload the avatar');
  }
}
