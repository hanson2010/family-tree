// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ApiError } from '@google/genai';
import { GeminiCallError, geminiIssue } from '../gemini';

const apiError = (status: number, message: string) => new ApiError({ status, message });

describe('geminiIssue', () => {
  it('recognizes used-up prepaid credits', () => {
    const error = apiError(
      402,
      '{"error":{"code":402,"message":"Your prepayment credits are depleted. Please go to AI Studio","status":"RESOURCE_EXHAUSTED"}}'
    );
    expect(geminiIssue(error)).toBe('billing');
  });

  it('recognizes a quota or rate limit', () => {
    expect(geminiIssue(apiError(429, 'Resource has been exhausted (e.g. check quota).'))).toBe('quota');
  });

  it('recognizes an invalid API key', () => {
    const error = apiError(400, '{"error":{"code":400,"message":"API key not valid.","status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}');
    expect(geminiIssue(error)).toBe('key');
  });

  it('recognizes Gemini being down', () => {
    expect(geminiIssue(apiError(503, 'The model is overloaded.'))).toBe('unavailable');
  });

  it('recognizes Gemini being unreachable', () => {
    const error = new TypeError('fetch failed', { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } });
    expect(geminiIssue(error)).toBe('unreachable');
  });

  it('falls back to a general failure', () => {
    expect(geminiIssue(new SyntaxError('Unexpected token'))).toBe('failed');
    expect(geminiIssue(apiError(400, 'Invalid JSON schema'))).toBe('failed');
  });

  it('keeps the kind and the original error on GeminiCallError', () => {
    const cause = apiError(402, 'prepayment credits are depleted');
    const error = new GeminiCallError('billing', cause);
    expect([error.issue, error.cause]).toEqual(['billing', cause]);
    expect(error.message).toContain('billing');
  });
});
