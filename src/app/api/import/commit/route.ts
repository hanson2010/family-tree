import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { errorResponse } from '@/lib/api-errors';
import { importRecords } from '@/lib/family-service';
import type { ImportResult } from '@/lib/import';
import type { ApiResponse } from '@/types';

// POST /api/import/commit - Save reviewed persons and relationships in one transaction
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const result = await importRecords(session?.user?.id, await request.json());
    return NextResponse.json<ApiResponse<ImportResult>>({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Failed to save the import');
  }
}
