import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT_OPTIONS, layoutFamilyTree } from '../tree-layout';
import type { Person, Relationship } from '@/types';
import { Gender, RelationshipType } from '@/types';

const person = (id: string, gender: Gender, generation: number, birthYear?: number): Person => ({
  id,
  name: id,
  gender,
  birthYear,
  isPrivate: false,
  createdBy: 'test-user',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  relativeGeneration: generation,
});

let relId = 0;
const rel = (a: string, b: string, type: RelationshipType): Relationship => ({
  id: `r${relId++}`,
  personAId: a,
  personBId: b,
  type,
  createdBy: 'test-user',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});
const parent = (p: string, c: string) => rel(p, c, RelationshipType.PARENT_CHILD);
const spouse = (a: string, b: string) => rel(a, b, RelationshipType.SPOUSE);

/** Ids of one generation, left to right */
function row(persons: Person[], relationships: Relationship[], generation: number): string[] {
  const { positions } = layoutFamilyTree(persons, relationships);
  return persons
    .filter((p) => p.relativeGeneration === generation)
    .map((p) => p.id)
    .sort((a, b) => positions.get(a)!.x - positions.get(b)!.x);
}

describe('layoutFamilyTree', () => {
  it('puts each generation on its own row', () => {
    const persons = [person('father', Gender.MALE, -1), person('child', Gender.MALE, 0)];
    const { positions } = layoutFamilyTree(persons, [parent('father', 'child')]);
    expect(positions.get('father')!.y).toBe(-DEFAULT_LAYOUT_OPTIONS.generationHeight);
    expect(positions.get('child')!.y).toBe(0);
  });

  it('orders siblings from oldest to youngest, with unknown birth years last', () => {
    const persons = [
      person('father', Gender.MALE, -1),
      person('young', Gender.FEMALE, 0, 1990),
      person('unknown', Gender.MALE, 0),
      person('old', Gender.MALE, 0, 1980),
      person('middle', Gender.FEMALE, 0, 1985),
    ];
    const rels = ['young', 'unknown', 'old', 'middle'].map((c) => parent('father', c));
    expect(row(persons, rels, 0)).toEqual(['old', 'middle', 'young', 'unknown']);
  });

  it('puts the husband left of his partners, undated ones by birth', () => {
    const persons = [
      person('concubine', Gender.FEMALE, 0, 1960),
      person('wife', Gender.FEMALE, 0, 1970),
      person('husband', Gender.MALE, 0, 1965),
      person('betrothed', Gender.FEMALE, 0, 1950),
    ];
    const rels = [
      rel('concubine', 'husband', RelationshipType.CONCUBINE),
      spouse('wife', 'husband'),
      rel('husband', 'betrothed', RelationshipType.BETROTHED),
    ];
    expect(row(persons, rels, 0)).toEqual(['husband', 'betrothed', 'concubine', 'wife']);
  });

  it('orders partners by start date whatever the relationship, then wife, concubine, betrothed', () => {
    const persons = [
      person('concubine', Gender.FEMALE, 0, 1960),
      person('wife', Gender.FEMALE, 0, 1950),
      person('husband', Gender.MALE, 0, 1945),
      person('betrothed', Gender.FEMALE, 0, 1940),
      person('unknown', Gender.FEMALE, 0),
    ];
    const rels = [
      { ...rel('concubine', 'husband', RelationshipType.CONCUBINE), startYear: 1965 },
      { ...spouse('wife', 'husband'), startYear: 1970 },
      { ...rel('husband', 'betrothed', RelationshipType.BETROTHED), startYear: 1980 },
      rel('unknown', 'husband', RelationshipType.CONCUBINE),
    ];
    expect(row(persons, rels, 0)).toEqual(['husband', 'concubine', 'wife', 'betrothed', 'unknown']);
  });

  it('puts the wife on the left when that makes fewer lines cross', () => {
    // The wife's father sits left of the husband's father, so wife-first avoids a crossing
    const persons = [
      person('grandpa', Gender.MALE, -2, 1900),
      person('herFather', Gender.MALE, -1, 1920),
      person('hisFather', Gender.MALE, -1, 1925),
      person('hisBrother', Gender.MALE, 0, 1945),
      person('husband', Gender.MALE, 0, 1950),
      person('wife', Gender.FEMALE, 0, 1952),
    ];
    const rels = [
      parent('grandpa', 'herFather'),
      parent('grandpa', 'hisFather'),
      parent('herFather', 'wife'),
      parent('hisFather', 'hisBrother'),
      parent('hisFather', 'husband'),
      spouse('husband', 'wife'),
    ];
    expect(row(persons, rels, -1)).toEqual(['herFather', 'hisFather']);
    expect(row(persons, rels, 0)).toEqual(['hisBrother', 'wife', 'husband']);
  });

  it('keeps the husband on the left when the order makes no difference to crossings', () => {
    const persons = [
      person('father', Gender.MALE, -1, 1920),
      person('son', Gender.MALE, 0, 1950),
      person('wife', Gender.FEMALE, 0, 1952),
    ];
    const rels = [parent('father', 'son'), spouse('son', 'wife')];
    expect(row(persons, rels, 0)).toEqual(['son', 'wife']);
  });

  it('keeps each sibling group under its own parents, in the parents’ order', () => {
    const persons = [
      person('grandpa', Gender.MALE, -2, 1900),
      person('elderSon', Gender.MALE, -1, 1920),
      person('youngerSon', Gender.MALE, -1, 1925),
      person('a1', Gender.MALE, 0, 1950),
      person('a2', Gender.FEMALE, 0, 1945),
      person('b1', Gender.MALE, 0, 1940),
    ];
    const rels = [
      parent('grandpa', 'elderSon'),
      parent('grandpa', 'youngerSon'),
      parent('elderSon', 'a1'),
      parent('elderSon', 'a2'),
      parent('youngerSon', 'b1'),
    ];
    // b1 is the oldest grandchild but belongs to the younger son, so comes last
    expect(row(persons, rels, 0)).toEqual(['a2', 'a1', 'b1']);
  });

  it('centers parents over their children', () => {
    const persons = [
      person('father', Gender.MALE, -1, 1950),
      person('mother', Gender.FEMALE, -1, 1952),
      person('c1', Gender.MALE, 0, 1975),
      person('c2', Gender.FEMALE, 0, 1978),
      person('c3', Gender.MALE, 0, 1980),
    ];
    const rels = [spouse('father', 'mother'), ...['c1', 'c2', 'c3'].flatMap((c) => [parent('father', c), parent('mother', c)])];
    const { positions } = layoutFamilyTree(persons, rels);
    const coupleCenter = (positions.get('father')!.x + positions.get('mother')!.x) / 2;
    expect(positions.get('c2')!.x).toBeCloseTo(coupleCenter, 0);
  });

  it('places a wife’s parents to the right of her husband’s parents', () => {
    const persons = [
      person('hisFather', Gender.MALE, -1, 1940),
      person('herFather', Gender.MALE, -1, 1930),
      person('husband', Gender.MALE, 0, 1965),
      person('wife', Gender.FEMALE, 0, 1968),
    ];
    const rels = [parent('hisFather', 'husband'), parent('herFather', 'wife'), spouse('husband', 'wife')];
    expect(row(persons, rels, -1)).toEqual(['hisFather', 'herFather']);
    expect(row(persons, rels, 0)).toEqual(['husband', 'wife']);
  });

  it('keeps siblings without visible parents together', () => {
    const persons = [
      person('cousin', Gender.MALE, 0, 1900),
      person('elder', Gender.MALE, 0, 1950),
      person('outsider', Gender.MALE, 0, 1940),
      person('younger', Gender.FEMALE, 0, 1960),
    ];
    const rels = [
      rel('elder', 'younger', RelationshipType.SIBLING),
      rel('cousin', 'outsider', RelationshipType.SWORN_SIBLING),
    ];
    const order = row(persons, rels, 0);
    expect(Math.abs(order.indexOf('elder') - order.indexOf('younger'))).toBe(1);
    expect(order.indexOf('elder')).toBeLessThan(order.indexOf('younger'));
  });

  it('never lets two persons in a row overlap', () => {
    const persons = [
      person('g', Gender.MALE, -1, 1900),
      person('gw', Gender.FEMALE, -1, 1902),
      ...Array.from({ length: 6 }, (_, i) => person(`c${i}`, i % 2 ? Gender.FEMALE : Gender.MALE, 0, 1930 + i)),
      person('cw', Gender.FEMALE, 0, 1931),
    ];
    const rels = [
      spouse('g', 'gw'),
      ...Array.from({ length: 6 }, (_, i) => parent('g', `c${i}`)),
      spouse('c0', 'cw'),
    ];
    const { positions } = layoutFamilyTree(persons, rels);
    const xs = persons.filter((p) => p.relativeGeneration === 0).map((p) => positions.get(p.id)!.x).sort((a, b) => a - b);
    xs.slice(1).forEach((x, i) => expect(x - xs[i]).toBeGreaterThanOrEqual(DEFAULT_LAYOUT_OPTIONS.nodeSpacing - 1e-6));
  });
});
