/**
 * Limits on MCP traffic, counted in memory by each server instance (so a restart starts afresh,
 * and with several instances a token gets each instance's allowance; Cloud Run runs at most 2):
 *
 * - per token: 60 calls a minute, 20 of them writes; 2,000 calls a day, 500 of them writes;
 * - per IP address: 10 failed sign-ins (a missing or unknown token) a minute, after which the
 *   address is refused before its token is looked up.
 *
 * A refused call is not counted. Windows are fixed: a minute or a day from the first call in it.
 */

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export const MCP_LIMITS = {
  callsPerMinute: 60,
  writesPerMinute: 20,
  callsPerDay: 2000,
  writesPerDay: 500,
  failedSignInsPerMinute: 10,
} as const;

/** Tools that change data; any other call counts as a read */
const WRITE_TOOL = /^(create|update|delete|merge|set|remove|add|assign)_/;

/** Counts per key in fixed windows of `length` ms */
class Window {
  private counts = new Map<string, { start: number; count: number }>();

  constructor(private readonly length: number) {}

  /** The count in the key's current window, and when that window ends */
  peek(key: string, now: number): { count: number; endsAt: number } {
    const entry = this.counts.get(key);
    if (!entry || now - entry.start >= this.length) return { count: 0, endsAt: now + this.length };
    return { count: entry.count, endsAt: entry.start + this.length };
  }

  add(key: string, now: number): void {
    const entry = this.counts.get(key);
    if (!entry || now - entry.start >= this.length) this.counts.set(key, { start: now, count: 1 });
    else entry.count++;
    if (this.counts.size > 10_000) this.prune(now);
  }

  private prune(now: number): void {
    for (const [key, entry] of this.counts) if (now - entry.start >= this.length) this.counts.delete(key);
  }
}

/** Refused: how many seconds until the call would be allowed */
export type Verdict = { allowed: true } | { allowed: false; retryAfter: number; reason: string };

export class McpLimiter {
  private callsMinute = new Window(MINUTE);
  private writesMinute = new Window(MINUTE);
  private callsDay = new Window(DAY);
  private writesDay = new Window(DAY);
  private failures = new Window(MINUTE);

  constructor(private readonly clock: () => number = Date.now) {}

  /** Count a call of a token, unless it is over a limit */
  call(tokenId: string, isWrite: boolean): Verdict {
    const now = this.clock();
    const checks: [Window, number, string][] = [
      [this.callsMinute, MCP_LIMITS.callsPerMinute, `${MCP_LIMITS.callsPerMinute} calls a minute`],
      [this.callsDay, MCP_LIMITS.callsPerDay, `${MCP_LIMITS.callsPerDay} calls a day`],
    ];
    if (isWrite) {
      checks.push(
        [this.writesMinute, MCP_LIMITS.writesPerMinute, `${MCP_LIMITS.writesPerMinute} writes a minute`],
        [this.writesDay, MCP_LIMITS.writesPerDay, `${MCP_LIMITS.writesPerDay} writes a day`]
      );
    }
    for (const [window, limit, reason] of checks) {
      const { count, endsAt } = window.peek(tokenId, now);
      if (count >= limit) return { allowed: false, retryAfter: Math.max(1, Math.ceil((endsAt - now) / 1000)), reason };
    }
    this.callsMinute.add(tokenId, now);
    this.callsDay.add(tokenId, now);
    if (isWrite) {
      this.writesMinute.add(tokenId, now);
      this.writesDay.add(tokenId, now);
    }
    return { allowed: true };
  }

  /** Whether an address has failed to sign in too often this minute */
  blocked(ip: string): Verdict {
    const now = this.clock();
    const { count, endsAt } = this.failures.peek(ip, now);
    return count >= MCP_LIMITS.failedSignInsPerMinute
      ? { allowed: false, retryAfter: Math.max(1, Math.ceil((endsAt - now) / 1000)), reason: 'too many failed sign-ins' }
      : { allowed: true };
  }

  /** Count a failed sign-in from an address */
  failed(ip: string): void {
    this.failures.add(ip, this.clock());
  }
}

/** Whether an MCP request body (one JSON-RPC message or a batch) calls a tool that changes data */
export function callsWriteTool(body: unknown): boolean {
  const messages = Array.isArray(body) ? body : [body];
  return messages.some((m) => {
    const message = m as { method?: unknown; params?: { name?: unknown } } | null;
    return message?.method === 'tools/call' && typeof message.params?.name === 'string' && WRITE_TOOL.test(message.params.name);
  });
}
