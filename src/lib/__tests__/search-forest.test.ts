import { describe, expect, it } from 'vitest';
import { matchesQuery, searchForest } from '../search-forest';
import { Gender, RelationshipType, type Person, type Relationship } from '@/types';

const P = (id: string, name: string, birthYear: number, extra: Partial<Person> = {}): Person => ({
  id,
  name,
  gender: Gender.FEMALE,
  birthYear,
  isPrivate: false,
  createdBy: 'u',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...extra,
});
let n = 0;
const parent = (a: string, b: string): Relationship => ({
  id: `r${n++}`,
  personAId: a,
  personBId: b,
  type: RelationshipType.PARENT_CHILD,
  createdBy: 'u',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const persons = [
  P('gf', '贾代善', 1650, { gender: Gender.MALE }),
  P('she', '贾赦', 1680, { gender: Gender.MALE }),
  P('zheng', '贾政', 1685, { gender: Gender.MALE }),
  P('ying', '贾迎春', 1718),
  P('tan', '贾探春', 1717),
  P('yan', '春燕', 1722),
  P('zhen', '甄英莲', 1712, { otherNames: ['香菱'] }),
];
const relationships = [parent('gf', 'she'), parent('gf', 'zheng'), parent('she', 'ying'), parent('zheng', 'tan')];

describe('matchesQuery', () => {
  it('matches any part of the name, 字, 号 or other names', () => {
    expect(matchesQuery(persons[6], '香菱')).toBe(true);
    expect(matchesQuery(persons[3], '迎')).toBe(true);
    expect(matchesQuery(persons[3], '  ')).toBe(false);
  });
});

describe('searchForest', () => {
  const forest = searchForest(persons, relationships, persons.filter((p) => matchesQuery(p, '春')));

  it('joins matches in one family through the fewest connectors', () => {
    expect(forest.matchIds).toEqual(new Set(['ying', 'tan', 'yan']));
    expect(forest.connectorIds).toEqual(new Set(['gf', 'she', 'zheng']));
  });

  it('draws matches and connectors only, without overlaps', () => {
    expect([...forest.positions.keys()].sort()).toEqual(['gf', 'she', 'tan', 'yan', 'ying', 'zheng'].sort());
    const spots = [...forest.positions.values()].map((p) => `${p.x},${p.y}`);
    expect(new Set(spots).size).toBe(spots.length);
  });

  it('places an unrelated match to the right of the trees', () => {
    const treeRight = Math.max(...['gf', 'she', 'zheng', 'ying', 'tan'].map((id) => forest.positions.get(id)!.x));
    expect(forest.positions.get('yan')!.x).toBeGreaterThan(treeRight);
  });
});
