import { NextResponse } from 'next/server';
import { ServiceError } from '@/lib/family-service';
import type { ApiResponse } from '@/types';

/** The JSON response for a failed request: a refused one with its status, anything else as 500 */
export function errorResponse(error: unknown, fallback: string): NextResponse<ApiResponse<never>> {
  if (error instanceof ServiceError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  console.error(`${fallback}:`, error);
  return NextResponse.json({ success: false, error: fallback }, { status: 500 });
}
