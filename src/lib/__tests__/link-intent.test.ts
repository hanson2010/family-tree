import { describe, expect, it } from 'vitest';
import { createLinkIntent, verifyLinkIntent } from '../link-intent';

describe('link intent', () => {
  it('verifies to the account it was made for', () => {
    expect(verifyLinkIntent(createLinkIntent('account-1'))).toBe('account-1');
  });

  it('refuses a changed signature, a missing value and an expired intent', () => {
    const intent = createLinkIntent('account-1');
    const tampered = intent.slice(0, -1) + (intent.endsWith('A') ? 'B' : 'A');
    expect(verifyLinkIntent(tampered)).toBeNull();
    expect(verifyLinkIntent(undefined)).toBeNull();
    expect(verifyLinkIntent(createLinkIntent('account-1', Date.now() - 11 * 60 * 1000))).toBeNull();
  });
});
