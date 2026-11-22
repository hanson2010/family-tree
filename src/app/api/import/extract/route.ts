import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { extractFamily, type SourceFile } from '@/lib/import-extract';
import { GeminiCallError } from '@/lib/gemini';
import type { Extraction } from '@/lib/import';
import type { ApiResponse } from '@/types';

const MAX_TEXT_LENGTH = 30000;
const MAX_FILES = 6;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_SIZE = 20 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

const fail = (error: string, status: number) => NextResponse.json<ApiResponse<never>>({ success: false, error }, { status });

// POST /api/import/extract - Find persons and relationships in text and page images; saves nothing
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return fail('Unauthorized', 401);

    const form = await request.formData();
    const text = String(form.get('text') ?? '');
    const uploads = form.getAll('files').filter((f): f is File => f instanceof File);

    if (!text.trim() && uploads.length === 0) return fail('Provide text or at least one file.', 400);
    if (text.length > MAX_TEXT_LENGTH) return fail(`Text is longer than ${MAX_TEXT_LENGTH} characters.`, 400);
    if (uploads.length > MAX_FILES) return fail(`At most ${MAX_FILES} files.`, 400);
    if (uploads.some((f) => !ALLOWED_TYPES.includes(f.type))) {
      return fail('Invalid file type. Allowed types: JPEG, PNG, GIF, WebP, PDF.', 400);
    }
    if (uploads.some((f) => f.size > MAX_FILE_SIZE)) return fail('A file is larger than 10MB.', 400);
    if (uploads.reduce((sum, f) => sum + f.size, 0) > MAX_TOTAL_SIZE) return fail('Files total more than 20MB.', 400);

    const files: SourceFile[] = await Promise.all(
      uploads.map(async (f) => ({ data: Buffer.from(await f.arrayBuffer()), mimeType: f.type }))
    );
    const extraction = await extractFamily(text, files);
    return NextResponse.json<ApiResponse<Extraction>>({ success: true, data: extraction });
  } catch (error) {
    console.error('Error extracting family records:', error);
    if (error instanceof GeminiCallError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: error.message, geminiIssue: error.issue },
        { status: 502 }
      );
    }
    return fail('Failed to read the records', 500);
  }
}
