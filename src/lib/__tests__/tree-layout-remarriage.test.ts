import { describe, expect, it } from 'vitest';
import { layoutFamilyTree } from '../tree-layout';
import { Gender as G, RelationshipType as T, type Person, type Relationship } from '@/types';

const persons: Person[] = [];
const relationships: Relationship[] = [];
let n = 0;
const P = (id: string, gender: G, birthYear: number, relativeGeneration: number) =>
  persons.push({
    id,
    name: id,
    gender,
    birthYear,
    relativeGeneration,
    isPrivate: false,
    createdBy: 'u',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
const R = (a: string, b: string, type = T.PARENT_CHILD, startYear: number | null = null) =>
  relationships.push({
    id: `r${n++}`,
    personAId: a,
    personBId: b,
    type,
    startYear,
    createdBy: 'u',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

// 毛泽东 + 杨开慧 → 毛岸英, 毛岸青, 毛岸龙. 刘思齐 married 毛岸英 (1949), later 杨茂之 (1962); 邵华 married 毛岸青
P('毛泽东', G.MALE, 1893, 0);
P('杨开慧', G.FEMALE, 1901, 0);
R('杨开慧', '毛泽东', T.SPOUSE, 1920);
for (const [id, year] of [['毛岸英', 1922], ['毛岸青', 1923], ['毛岸龙', 1927]] as const) {
  P(id, G.MALE, year, 1);
  R('毛泽东', id);
  R('杨开慧', id);
}
P('刘思齐', G.FEMALE, 1930, 1);
P('杨茂之', G.MALE, 1931, 1);
P('邵华', G.FEMALE, 1938, 1);
R('刘思齐', '毛岸英', T.SPOUSE, 1949);
R('刘思齐', '杨茂之', T.SPOUSE, 1962);
R('邵华', '毛岸青', T.SPOUSE, 1960);

describe('a woman married more than once', () => {
  it('stands between her husbands, the first on her left, next to them', () => {
    const { positions } = layoutFamilyTree(persons, relationships);
    const x = (id: string) => positions.get(id)!.x;
    expect(x('毛岸英')).toBeLessThan(x('刘思齐'));
    expect(x('刘思齐')).toBeLessThan(x('杨茂之'));
    // Nobody else stands between them
    const between = persons.filter((p) => p.relativeGeneration === 1 && x(p.id) > x('毛岸英') && x(p.id) < x('杨茂之'));
    expect(between.map((p) => p.id)).toEqual(['刘思齐']);
  });
});
