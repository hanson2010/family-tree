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

// 吕明山 + 吕妻 → {吕女 (daughter), 吕子 (son)}; 吕女 + 胡父 → 胡畔阳 → 胡曾孙; 吕子 → 吕孙女 → 吕曾孙
P('吕明山', G.MALE, 1940);
P('吕妻', G.FEMALE, 1942);
P('吕女', G.FEMALE, 1965);
P('胡父', G.MALE, 1963);
P('胡畔阳', G.MALE, 1990);
P('胡曾孙', G.MALE, 2015);
P('吕子', G.MALE, 1968);
P('吕孙女', G.FEMALE, 1993);
P('吕曾孙', G.MALE, 2018);
R('吕妻', '吕明山', T.SPOUSE);
for (const child of ['吕女', '吕子']) {
  R('吕明山', child);
  R('吕妻', child);
}
R('胡父', '吕女', T.SPOUSE);
R('吕女', '胡畔阳');
R('胡父', '胡畔阳');
R('胡畔阳', '胡曾孙');
R('吕子', '吕孙女');
R('吕孙女', '吕曾孙');

const term = (from: string, to: string) => calculateDetailedRelationship(from, to, persons, relationships).term;

describe('grandchildren', () => {
  it("calls a daughter's children 外孙 / 外孙女, whoever the grandparent is", () => {
    expect(term('吕明山', '胡畔阳')).toBe('外孙');
    expect(term('吕妻', '胡畔阳')).toBe('外孙');
  });

  it("calls a son's children 孙子 / 孙女, whoever the grandparent is", () => {
    expect(term('吕明山', '吕孙女')).toBe('孙女');
    expect(term('吕妻', '吕孙女')).toBe('孙女');
  });

  it('marks 外 for a daughter anywhere down the line, as relationship.js does', () => {
    expect(term('吕明山', '胡曾孙')).toBe('外曾孙');
    // A son's daughter's son (the old engine said 曾孙, following the first child only)
    expect(term('吕明山', '吕曾孙')).toBe('曾外孙');
  });

  it('still names grandparents by the parent on the line', () => {
    expect(term('胡畔阳', '吕明山')).toBe('外祖父');
    expect(term('吕孙女', '吕明山')).toBe('祖父');
  });
});
