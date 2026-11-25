import { describe, expect, it } from 'vitest';
import { cn } from '../utils';

describe('cn (className merge utility)', () => {
  it('should merge class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    expect(cn('base', true && 'included', false && 'excluded')).toBe('base included');
  });

  it('should merge tailwind classes correctly', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('should handle undefined and null values', () => {
    expect(cn('base', undefined, null, 'end')).toBe('base end');
  });

  it('should handle arrays of classes', () => {
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz');
  });

  it('should handle objects with boolean values', () => {
    expect(cn({ active: true, disabled: false })).toBe('active');
  });
});
