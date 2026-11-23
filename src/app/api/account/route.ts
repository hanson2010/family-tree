import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { errorResponse } from '@/lib/api-errors';
import { listIdentities, PROVIDERS, type Provider } from '@/lib/accounts';
import type { ApiResponse } from '@/types';

export interface AccountInfo {
  /** Sign-in providers, Google first */
  available: Provider[];
  identities: { id: string; provider: Provider; email: string | null; name: string | null }[];
}

// GET /api/account - The signed-in account's sign-in identities, and the sign-in providers
export async function GET() {
  try {
    const session = await auth();
    const accountId = session?.user?.id;
    if (!accountId) return NextResponse.json<ApiResponse<never>>({ success: false, error: 'Unauthorized' }, { status: 401 });
    const identities = (await listIdentities(accountId)).map(({ id, provider, email, name }) => ({ id, provider, email, name }));
    return NextResponse.json<ApiResponse<AccountInfo>>({
      success: true,
      data: { available: PROVIDERS, identities },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to read the account');
  }
}
