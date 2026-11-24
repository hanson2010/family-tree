import { describe, expect, it } from 'vitest';
import { calculateDetailedRelationship } from '../chinese-kinship';
import { Gender as G, RelationshipType as T, type Person, type Relationship } from '@/types';

const persons: Person[] = [];
const relationships: Relationship[] = [];
let n = 0;
const P = (id: string, gender: G, birthYear: number) =>
  persons.push({
    id,
    name: id,
    gender,
    birthYear,
    isPrivate: false,
    createdBy: 'u',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
const R = (a: string, b: string, type = T.PARENT_CHILD) =>
  relationships.push({
    id: `r${n++}`,
    personAId: a,
    personBId: b,
    type,
    createdBy: 'u',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

// 我 + 我妻 → 子, 女; 子 → 孙, 孙女; 女 → 外孙; 孙 → 曾孙; each grandchild and great-grandchild married
P('我', G.MALE, 1900);
P('我妻', G.FEMALE, 1902);
R('我妻', '我', T.SPOUSE);
P('子', G.MALE, 1925);
P('女', G.FEMALE, 1927);
for (const child of ['子', '女']) {
  R('我', child);
  R('我妻', child);
}
P('孙', G.MALE, 1950);
P('孙女', G.FEMALE, 1953);
P('外孙', G.MALE, 1951);
P('外孙女', G.FEMALE, 1954);
R('子', '孙');
R('子', '孙女');
R('女', '外孙');
R('女', '外孙女');
P('曾孙', G.MALE, 1975);
P('曾孙女', G.FEMALE, 1978);
R('孙', '曾孙');
R('孙', '曾孙女');
P('外曾孙', G.MALE, 1976);
R('外孙', '外曾孙');
const spouses: [string, string, G][] = [
  ['孙', '孙媳', G.FEMALE],
  ['孙女', '孙女婿', G.MALE],
  ['外孙', '外孙媳', G.FEMALE],
  ['外孙女', '外孙女婿', G.MALE],
  ['曾孙', '曾孙媳', G.FEMALE],
  ['曾孙女', '曾孙女婿', G.MALE],
  ['外曾孙', '外曾孙媳', G.FEMALE],
];
for (const [descendant, spouse, sex] of spouses) {
  P(spouse, sex, 1960);
  R(sex === G.FEMALE ? spouse : descendant, sex === G.FEMALE ? descendant : spouse, T.SPOUSE);
}

const term = (from: string, to: string) => calculateDetailedRelationship(from, to, persons, relationships).term;

describe('spouses of grandchildren and great-grandchildren', () => {
  it('are named from the ancestor, with 外 through a daughter', () => {
    for (const [, spouse] of spouses) expect(term('我', spouse)).toBe(spouse);
  });

  it('a granddaughter’s husband calls her grandparents 岳祖父 / 岳祖母', () => {
    expect(term('孙女婿', '我')).toBe('岳祖父');
    expect(term('孙女婿', '我妻')).toBe('岳祖母');
    expect(term('外孙女婿', '我')).toBe('岳外祖父');
    expect(term('曾孙女婿', '我')).toBe('岳曾祖父');
  });

  it('a grandchild’s wife uses her husband’s terms', () => {
    expect(term('孙媳', '我')).toBe('祖父');
    expect(term('外孙媳', '我')).toBe('外祖父');
  });
});
