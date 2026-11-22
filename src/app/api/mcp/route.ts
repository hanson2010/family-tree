import { createMcpHandler } from '@modelcontextprotocol/server';
import { verifyToken } from '@/lib/api-tokens';
import { createFamilyTreeServer } from '@/lib/mcp-tools';

// MCP endpoint (stateless, current and 2025-era clients). Clients authenticate with a personal
// access token from the /tokens page: `Authorization: Bearer <token>`.

export const dynamic = 'force-dynamic';

const handler = createMcpHandler(({ authInfo }) => createFamilyTreeServer(String(authInfo?.extra?.userId)));

async function serve(request: Request): Promise<Response> {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)\s*$/i)?.[1];
  const owner = token ? await verifyToken(token) : null;
  if (!token || !owner) {
    return new Response(JSON.stringify({ error: 'invalid_token', error_description: 'A valid personal access token is required.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer realm="family-tree", error="invalid_token"' },
    });
  }
  return handler.fetch(request, {
    authInfo: { token, clientId: owner.tokenId, scopes: [], extra: { userId: owner.userId } },
  });
}

export { serve as GET, serve as POST, serve as DELETE };
