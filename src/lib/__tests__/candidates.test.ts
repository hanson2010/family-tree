import { describe, expect, it } from 'vitest';
import { connectedPersonIds, familyHints, linkedPersonIds, rankCandidates, relationshipHints } from '../candidates';
import type { Person, Relationship } from '@/types';
import { Gender, RelationshipType } from '@/types';

const person = (id: string, gender: Gender, birthYear?: number): Person => ({
  id,
  name: id,
  gender,
  birthYear,
  isPrivate: false,
  createdBy: 'u',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const rel = (a: string, b: string, type = RelationshipType.PARENT_CHILD): Relationship => ({
  id: `${a}-${b}`,
  personAId: a,
  personBId: b,
  type,
  createdBy: 'u',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const ids = (persons: Person[]) => persons.map((p) => p.id);

describe('rankCandidates', () => {
  it('puts unlinked persons before linked ones', () => {
    const persons = [person('linked', Gender.MALE), person('unlinked', Gender.MALE)];
    expect(ids(rankCandidates(persons, { linkedIds: new Set(['linked']) }))).toEqual(['unlinked', 'linked']);
  });

  it('puts implausible persons last, even when unlinked', () => {
    const persons = [person('wrongEra', Gender.MALE, 1900), person('rightEra', Gender.MALE, 1700)];
    const ranked = rankCandidates(persons, {
      linkedIds: new Set(['rightEra']),
      hint: { birthYears: { from: 1680, to: 1720 } },
    });
    expect(ids(ranked)).toEqual(['rightEra', 'wrongEra']);
  });

  it('prefers the expected gender, then unknown gender, then the opposite', () => {
    const persons = [person('f', Gender.FEMALE), person('u', Gender.UNKNOWN), person('m', Gender.MALE)];
    expect(ids(rankCandidates(persons, { linkedIds: new Set(), hint: { gender: Gender.MALE } }))).toEqual(['m', 'u', 'f']);
  });

  it('prefers a birth year in range to an unknown one, and nearer years among the rest', () => {
    const persons = [person('far', Gender.MALE, 1500), person('none', Gender.MALE), person('near', Gender.MALE, 1650), person('in', Gender.MALE, 1700)];
    const ranked = rankCandidates(persons, { linkedIds: new Set(), hint: { birthYears: { from: 1680, to: 1720 } } });
    expect(ids(ranked)).toEqual(['in', 'none', 'near', 'far']);
  });

  it('searches name, courtesy name and art name, and leaves out excluded persons', () => {
    const persons = [
      { ...person('a', Gender.MALE), name: '贾政', courtesyName: '存周' },
      { ...person('b', Gender.MALE), name: '贾宝玉', artName: '怡红公子' },
      { ...person('c', Gender.MALE), name: '贾琏' },
    ];
    expect(ids(rankCandidates(persons, { query: '存周', linkedIds: new Set() }))).toEqual(['a']);
    expect(ids(rankCandidates(persons, { query: '怡红', linkedIds: new Set() }))).toEqual(['b']);
    expect(ids(rankCandidates(persons, { query: '贾', excludeIds: ['c'], linkedIds: new Set() })).sort()).toEqual(['a', 'b']);
  });
});

describe('hints', () => {
  it('expects parents 15 to 60 years older than the child (mother up to 50)', () => {
    const hints = familyHints(null, null, person('child', Gender.MALE, 1750));
    expect(hints.father.birthYears).toEqual({ from: 1690, to: 1735 });
    expect(hints.mother.birthYears).toEqual({ from: 1700, to: 1735 });
  });

  it('expects a child born when both parents could have had them', () => {
    const hints = familyHints(person('dad', Gender.MALE, 1700), person('mom', Gender.FEMALE, 1710), null);
    expect(hints.child.birthYears).toEqual({ from: 1725, to: 1760 });
  });

  it('expects a spouse of the opposite gender and a similar age', () => {
    const { b } = relationshipHints(RelationshipType.SPOUSE, person('a', Gender.MALE, 1700), null);
    expect(b).toEqual({ gender: Gender.FEMALE, birthYears: { from: 1680, to: 1720 } });
  });

  it('expects siblings born within 25 years of each other', () => {
    const { b } = relationshipHints(RelationshipType.SIBLING, person('a', Gender.MALE, 1700), null);
    expect(b).toEqual({ birthYears: { from: 1675, to: 1725 } });
  });

  it('expects a female concubine as A and a male husband as B', () => {
    const { a, b } = relationshipHints(RelationshipType.CONCUBINE, null, null);
    expect(a.gender).toBe(Gender.FEMALE);
    expect(b.gender).toBe(Gender.MALE);
  });
});

describe('linkedPersonIds and connectedPersonIds', () => {
  const relationships = [rel('a', 'b'), rel('b', 'c'), rel('x', 'y')];

  it('lists persons in at least one relationship', () => {
    expect([...linkedPersonIds(relationships)].sort()).toEqual(['a', 'b', 'c', 'x', 'y']);
  });

  it('finds everyone connected to a person', () => {
    expect([...connectedPersonIds('c', relationships)].sort()).toEqual(['a', 'b', 'c']);
    expect([...connectedPersonIds('alone', relationships)]).toEqual(['alone']);
  });
});
