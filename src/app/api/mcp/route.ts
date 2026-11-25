import { createMcpHandler } from '@modelcontextprotocol/server';
import { verifyToken } from '@/lib/api-tokens';
import { resolveAccountId } from '@/lib/account-merge';
import { createFamilyTreeServer } from '@/lib/mcp-tools';
import { McpLimiter, callsWriteTool, type Verdict } from '@/lib/rate-limit';

// MCP endpoint (stateless, current and 2025-era clients). Clients authenticate with a personal
// access token from the /tokens page: `Authorization: Bearer <token>`. Calls are limited per token
// and failed sign-ins per address (rate-limit.ts).

export const dynamic = 'force-dynamic';

const handler = createMcpHandler(({ authInfo }) => createFamilyTreeServer(String(authInfo?.extra?.userId)));
const limiter = new McpLimiter();

const json = (status: number, body: object, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

const tooMany = (verdict: Extract<Verdict, { allowed: false }>) =>
  json(
    429,
    { error: 'rate_limited', error_description: `Too many requests (${verdict.reason}). Try again in ${verdict.retryAfter} s.` },
    { 'Retry-After': String(verdict.retryAfter) }
  );

/** The caller's address: the first one Cloud Run's front end records */
const clientIp = (request: Request) =>
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';

async function serve(request: Request): Promise<Response> {
  const ip = clientIp(request);
  const blocked = limiter.blocked(ip);
  if (!blocked.allowed) return tooMany(blocked);

  const token = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)\s*$/i)?.[1];
  const owner = token ? await verifyToken(token) : null;
  if (!token || !owner) {
    limiter.failed(ip);
    return json(
      401,
      { error: 'invalid_token', error_description: 'A valid personal access token is required.' },
      { 'WWW-Authenticate': 'Bearer realm="family-tree", error="invalid_token"' }
    );
  }

  let body: unknown = null;
  if (request.method === 'POST') {
    try {
      body = await request.clone().json();
    } catch {
      // Not JSON: the MCP handler answers it
    }
  }
  const verdict = limiter.call(owner.tokenId, callsWriteTool(body));
  if (!verdict.allowed) return tooMany(verdict);

  // A token of an account merged into another acts for that account
  const userId = await resolveAccountId(owner.userId);
  return handler.fetch(request, {
    authInfo: { token, clientId: owner.tokenId, scopes: [], extra: { userId } },
  });
}

export { serve as GET, serve as POST, serve as DELETE };
