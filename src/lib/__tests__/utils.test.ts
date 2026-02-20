import { cn, formatDate, getGenderColor } from '../utils';

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

describe('formatDate', () => {
  it('should return empty string when no values provided', () => {
    expect(formatDate()).toBe('');
    expect(formatDate(null, null, null)).toBe('');
  });

  it('should format year only', () => {
    expect(formatDate(2024)).toBe('2024');
  });

  it('should format year and month', () => {
    expect(formatDate(2024, 3)).toBe('2024/03');
  });

  it('should format full date', () => {
    expect(formatDate(2024, 3, 15)).toBe('2024/03/15');
  });

  it('should pad month and day with zeros', () => {
    expect(formatDate(2024, 1, 5)).toBe('2024/01/05');
  });

  it('should handle month and day without year', () => {
    expect(formatDate(null, 6, 15)).toBe('06/15');
  });

  it('should handle day only', () => {
    expect(formatDate(null, null, 25)).toBe('25');
  });
});

describe('getGenderColor', () => {
  it('should return correct male colors for each generation', () => {
    expect(getGenderColor('MALE', -2)).toBe('#1E40AF');
    expect(getGenderColor('MALE', -1)).toBe('#1D4ED8');
    expect(getGenderColor('MALE', 0)).toBe('#2563EB');
    expect(getGenderColor('MALE', 1)).toBe('#3B82F6');
    expect(getGenderColor('MALE', 2)).toBe('#60A5FA');
    expect(getGenderColor('MALE', 3)).toBe('#93C5FD');
  });

  it('should return correct female colors for each generation', () => {
    expect(getGenderColor('FEMALE', -2)).toBe('#F59E0B');
    expect(getGenderColor('FEMALE', -1)).toBe('#FBBF24');
    expect(getGenderColor('FEMALE', 0)).toBe('#FCD34D');
    expect(getGenderColor('FEMALE', 1)).toBe('#FDE68A');
    expect(getGenderColor('FEMALE', 2)).toBe('#FEF3C7');
    expect(getGenderColor('FEMALE', 3)).toBe('#FFFBEB');
  });

  it('should return default colors for unknown generation', () => {
    expect(getGenderColor('MALE', 10)).toBe('#2563EB');
    expect(getGenderColor('FEMALE', 10)).toBe('#FCD34D');
  });

  it('should return gray for unknown gender', () => {
    expect(getGenderColor('UNKNOWN', 0)).toBe('#9CA3AF');
    expect(getGenderColor('', 0)).toBe('#9CA3AF');
  });
});
