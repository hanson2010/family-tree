import { describe, expect, it } from 'vitest';
import { MCP_LIMITS, McpLimiter, callsWriteTool } from '../rate-limit';

const clockAt = (start = 0) => {
  const clock = { now: start, fn: () => clock.now };
  return clock;
};

describe('McpLimiter', () => {
  it('allows 60 calls a minute per token, then asks to wait for the rest of the minute', () => {
    const clock = clockAt();
    const limiter = new McpLimiter(clock.fn);
    for (let i = 0; i < MCP_LIMITS.callsPerMinute; i++) expect(limiter.call('t1', false).allowed).toBe(true);
    clock.now = 45_000;
    const refused = limiter.call('t1', false);
    expect(refused.allowed).toBe(false);
    expect(refused.allowed === false && refused.retryAfter).toBe(15);
    expect(limiter.call('t2', false).allowed).toBe(true);
    clock.now = 60_000;
    expect(limiter.call('t1', false).allowed).toBe(true);
  });

  it('allows 20 writes a minute, while reads go on', () => {
    const limiter = new McpLimiter(clockAt().fn);
    for (let i = 0; i < MCP_LIMITS.writesPerMinute; i++) expect(limiter.call('t', true).allowed).toBe(true);
    expect(limiter.call('t', true).allowed).toBe(false);
    expect(limiter.call('t', false).allowed).toBe(true);
  });

  it('allows 500 writes and 2,000 calls a day', () => {
    const clock = clockAt();
    const limiter = new McpLimiter(clock.fn);
    let writes = 0;
    let calls = 0;
    // A write every 4 seconds stays under the minute limits
    for (let i = 0; i < 3000; i++, clock.now += 4000) {
      if (limiter.call('t', true).allowed) writes++;
    }
    expect(writes).toBe(MCP_LIMITS.writesPerDay);
    for (let i = 0; i < 3000; i++, clock.now += 2000) {
      if (limiter.call('t', false).allowed) calls++;
    }
    expect(calls).toBe(MCP_LIMITS.callsPerDay - MCP_LIMITS.writesPerDay);
  });

  it('blocks an address after 10 failed sign-ins in a minute', () => {
    const clock = clockAt();
    const limiter = new McpLimiter(clock.fn);
    for (let i = 0; i < MCP_LIMITS.failedSignInsPerMinute; i++) {
      expect(limiter.blocked('1.2.3.4').allowed).toBe(true);
      limiter.failed('1.2.3.4');
    }
    expect(limiter.blocked('1.2.3.4').allowed).toBe(false);
    expect(limiter.blocked('5.6.7.8').allowed).toBe(true);
    clock.now = 60_000;
    expect(limiter.blocked('1.2.3.4').allowed).toBe(true);
  });
});

describe('callsWriteTool', () => {
  it('tells tool calls that change data from the rest', () => {
    expect(callsWriteTool({ method: 'tools/call', params: { name: 'create_person' } })).toBe(true);
    expect(callsWriteTool({ method: 'tools/call', params: { name: 'assign_saved_face' } })).toBe(true);
    expect(callsWriteTool({ method: 'tools/call', params: { name: 'search_persons' } })).toBe(false);
    expect(callsWriteTool({ method: 'tools/list' })).toBe(false);
    expect(callsWriteTool([{ method: 'initialize' }, { method: 'tools/call', params: { name: 'delete_person' } }])).toBe(true);
    expect(callsWriteTool(null)).toBe(false);
  });
});
