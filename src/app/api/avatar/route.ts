import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { avatarsFromPhoto, centeredAvatar } from '@/lib/faces';
import type { ApiResponse, AvatarUploadResponse } from '@/types';

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// POST /api/avatar - A square avatar from the middle of an uploaded photo, or with `mode=faces`
// (group photos) one square avatar per face found by Gemini
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse<never>>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get('file');
    const findFaces = form.get('mode') === 'faces';
    if (!(file instanceof File)) {
      return NextResponse.json<ApiResponse<never>>({ success: false, error: 'No file provided' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'Invalid file type. Allowed types: JPEG, PNG, GIF, WebP.' },
        { status: 400 }
      );
    }

    const photo = Buffer.from(await file.arrayBuffer());
    if (!findFaces) {
      return NextResponse.json<AvatarUploadResponse>({ success: true, avatars: [await centeredAvatar(photo)], detected: false });
    }
    const { avatars, detected, geminiIssue } = await avatarsFromPhoto(photo);
    return NextResponse.json<AvatarUploadResponse>({ success: true, avatars, detected, geminiIssue });
  } catch (error) {
    console.error('Error processing avatar:', error);
    return NextResponse.json<ApiResponse<never>>({ success: false, error: 'Failed to process avatar' }, { status: 500 });
  }
}
