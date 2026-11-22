import { NextRequest, NextResponse } from 'next/server';
import { useUploadCode } from '@/lib/avatar-uploads';
import { errorResponse } from '@/lib/api-errors';
import type { ApiResponse } from '@/types';

// POST /api/avatar-upload/[code] - Set an avatar from a file sent with curl (-F file=@photo.jpg).
// The one-time code from the MCP tool prepare_avatar_upload is the only authorization needed.
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
    const person = await useUploadCode(code, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json<ApiResponse<{ person: string }>>({ success: true, data: { person: person.name } });
  } catch (error) {
    return errorResponse(error, 'Failed to upload the avatar');
  }
}
