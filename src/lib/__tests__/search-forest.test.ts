import { describe, expect, it } from 'vitest';
import { matchesQuery, searchForest, searchMatches, searchTerms } from '../search-forest';
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

  it('is first viewed at the middle of its largest tree', () => {
    const xs = ['gf', 'she', 'zheng', 'ying', 'tan'].map((id) => forest.positions.get(id)!.x);
    expect(forest.focus.x).toBe((Math.min(...xs) + Math.max(...xs)) / 2);
  });

  it('is first viewed at the middle of the single matches when there is no tree', () => {
    const singles = searchForest(persons, relationships, [persons[5], persons[6]]);
    const xs = [...singles.positions.values()].map((p) => p.x);
    expect(singles.focus).toEqual({ x: (Math.min(...xs) + Math.max(...xs)) / 2, y: 0 });
  });
});

describe('half siblings in the forest', () => {
  const family = [
    P('zheng', '贾政', 1685, { gender: Gender.MALE }),
    P('wang', '王夫人', 1688),
    P('zhao', '赵姨娘', 1695),
    P('yu', '贾宝玉', 1715, { gender: Gender.MALE }),
    P('tan', '贾探春', 1717),
    P('huan', '贾环', 1719, { gender: Gender.MALE }),
  ];
  const links = [
    parent('zheng', 'yu'), parent('wang', 'yu'),
    parent('zheng', 'tan'), parent('zhao', 'tan'),
    parent('zheng', 'huan'), parent('zhao', 'huan'),
  ];
  const connectors = (query: string) =>
    [...searchForest(family, links, searchMatches(family, links, family, query)).connectorIds].sort();

  it('draws both mothers of 同父异母 siblings', () => {
    expect(connectors('宝玉、探春')).toEqual(['wang', 'zhao', 'zheng']);
  });

  it('draws only the shared parent of full siblings', () => {
    expect(connectors('探春、贾环')).toEqual(['zheng']);
  });
});

describe('searching several strings', () => {
  const ids = (query: string) => searchMatches(persons, relationships, persons, query).map((p) => p.id).sort();

  it('splits the query at 、 and commas', () => {
    expect(searchTerms(' 贾政、王夫人，香菱 ,, 贾政 ')).toEqual(['贾政', '王夫人', '香菱']);
    expect(matchesQuery(persons[6], '贾政、香菱')).toBe(true);
  });

  it('keeps only families in which every string is matched', () => {
    // 贾政 and 迎春 share a family; 春燕 and 甄英莲 are on their own
    expect(ids('贾政、迎春')).toEqual(['ying', 'zheng']);
    expect(ids('贾政，春')).toEqual(['tan', 'ying', 'zheng']);
    expect(ids('贾政,香菱')).toEqual([]);
  });

  it('keeps a single person who matches every string', () => {
    expect(ids('甄、香菱')).toEqual(['zhen']);
  });

  it('matches as before with one string', () => {
    expect(ids('春')).toEqual(['tan', 'yan', 'ying']);
  });
});
