import { describe, expect, it } from 'vitest';
import { marriageOrdinals } from '../marriage-order';
import type { Relationship } from '@/types';
import { RelationshipType } from '@/types';

const marriage = (
  id: string,
  a: string,
  b: string,
  start?: [number, number?, number?],
  type = RelationshipType.SPOUSE
): Relationship => ({
  id,
  personAId: a,
  personBId: b,
  type,
  startYear: start?.[0] ?? null,
  startMonth: start?.[1] ?? null,
  startDay: start?.[2] ?? null,
  createdBy: 'u',
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('marriageOrdinals', () => {
  it('numbers a person’s marriages by start date', () => {
    const result = marriageOrdinals([
      marriage('meiling', 'jieshi', '宋美龄', [1927, 12, 1]),
      marriage('fumei', 'jieshi', '毛福梅', [1901]),
      marriage('jieru', 'jieshi', '陈洁如', [1921, 12, 5]),
    ]);
    expect(result.get('fumei')).toEqual([{ personId: 'jieshi', ordinal: 1 }]);
    expect(result.get('jieru')).toEqual([{ personId: 'jieshi', ordinal: 2 }]);
    expect(result.get('meiling')).toEqual([{ personId: 'jieshi', ordinal: 3 }]);
  });

  it('uses month and day within the same year', () => {
    const result = marriageOrdinals([marriage('late', 'x', 'b', [1900, 9]), marriage('early', 'x', 'a', [1900, 2, 3])]);
    expect(result.get('early')?.[0].ordinal).toBe(1);
    expect(result.get('late')?.[0].ordinal).toBe(2);
  });

  it('counts concubines with wives, but not other relationships', () => {
    const result = marriageOrdinals([
      marriage('wife', 'x', 'w', [1900]),
      marriage('concubine', 'x', 'c', [1910], RelationshipType.CONCUBINE),
      marriage('betrothed', 'x', 'b', [1890], RelationshipType.BETROTHED),
    ]);
    expect([result.get('wife')?.[0].ordinal, result.get('concubine')?.[0].ordinal]).toEqual([1, 2]);
    expect(result.has('betrothed')).toBe(false);
  });

  it('numbers neither a single marriage nor one without a start year', () => {
    const result = marriageOrdinals([
      marriage('only', 'p', 'q', [1950]),
      marriage('dated', 'x', 'a', [1900]),
      marriage('undated', 'x', 'b'),
    ]);
    expect(result.has('only')).toBe(false);
    expect(result.has('undated')).toBe(false);
    // One dated marriage says nothing about order
    expect(result.has('dated')).toBe(false);
  });

  it('numbers the dated marriages when at least two have a date', () => {
    const result = marriageOrdinals([
      marriage('second', 'x', 'b', [1920]),
      marriage('undated', 'x', 'c'),
      marriage('first', 'x', 'a', [1900]),
    ]);
    expect([result.get('first')?.[0].ordinal, result.get('second')?.[0].ordinal]).toEqual([1, 2]);
    expect(result.has('undated')).toBe(false);
  });

  it('numbers both ends when both partners married more than once', () => {
    const result = marriageOrdinals([
      marriage('herFirst', 'widow', 'h1', [1900]),
      marriage('hisFirst', 'widower', 'w1', [1890]),
      marriage('hisSecond', 'widower', 'w2', [1895]),
      marriage('together', 'widow', 'widower', [1910]),
    ]);
    expect(result.get('together')).toEqual([
      { personId: 'widow', ordinal: 2 },
      { personId: 'widower', ordinal: 3 },
    ]);
  });
});
