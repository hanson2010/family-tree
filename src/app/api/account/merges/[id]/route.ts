import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { errorResponse } from '@/lib/api-errors';
import {
  cancelMerge,
  confirmMerge,
  getPendingMerge,
  mergeSummary,
  type MergeSummary,
  type MoveCounts,
} from '@/lib/account-merge';
import type { ApiResponse } from '@/types';

type Params = { params: Promise<{ id: string }> };

const unauthorized = () => NextResponse.json<ApiResponse<never>>({ success: false, error: 'Unauthorized' }, { status: 401 });

/** The pending merge into the signed-in account, with its ID */
async function pending(params: Params['params']) {
  const accountId = (await auth())?.user?.id;
  if (!accountId) return null;
  const { id } = await params;
  return { id, merge: await getPendingMerge(id, accountId) };
}

// GET /api/account/merges/[id] - What merging the other account into the signed-in one would move
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const found = await pending(params);
    if (!found) return unauthorized();
    return NextResponse.json<ApiResponse<MergeSummary>>({ success: true, data: await mergeSummary(found.merge) });
  } catch (error) {
    return errorResponse(error, 'Failed to read the merge');
  }
}

// POST /api/account/merges/[id] - Merge the other account into the signed-in one; a merge that did
// not finish completes when confirmed again
export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const found = await pending(params);
    if (!found) return unauthorized();
    return NextResponse.json<ApiResponse<MoveCounts>>({ success: true, data: await confirmMerge(found.id, found.merge) });
  } catch (error) {
    return errorResponse(error, 'Merging did not finish. Confirm again to complete it.');
  }
}

// DELETE /api/account/merges/[id] - Cancel the merge; both accounts stay as they are
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const found = await pending(params);
    if (!found) return unauthorized();
    await cancelMerge(found.id);
    return NextResponse.json<ApiResponse<null>>({ success: true, data: null });
  } catch (error) {
    return errorResponse(error, 'Failed to cancel the merge');
  }
}
