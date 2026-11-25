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

// Father's line: 曾祖 → {祖父, 伯祖, 姑婆}; 祖父 → {父, 伯父, 姑}; 父 + 母 → {我, 兄, 姐}
P('我', G.MALE, 1620);
P('父', G.MALE, 1590);
P('母', G.FEMALE, 1595);
P('兄', G.MALE, 1615);
P('姐', G.FEMALE, 1612);
P('祖父', G.MALE, 1560);
P('曾祖', G.MALE, 1530);
P('伯祖', G.MALE, 1555);
P('姑婆', G.FEMALE, 1565);
P('伯父', G.MALE, 1585);
P('姑', G.FEMALE, 1592);
R('母', '父', T.SPOUSE);
for (const child of ['我', '兄', '姐']) {
  R('父', child);
  R('母', child);
}
R('祖父', '父');
R('祖父', '伯父');
R('祖父', '姑');
R('曾祖', '祖父');
R('曾祖', '伯祖');
R('曾祖', '姑婆');
// Their descendants
P('侄', G.MALE, 1640);
P('侄孙', G.MALE, 1665);
R('兄', '侄');
R('侄', '侄孙');
P('外甥女', G.FEMALE, 1638);
P('外甥孙', G.MALE, 1662);
R('姐', '外甥女');
R('外甥女', '外甥孙');
P('堂兄', G.MALE, 1615);
P('堂侄女', G.FEMALE, 1640);
R('伯父', '堂兄');
R('堂兄', '堂侄女');
P('表弟', G.MALE, 1625);
P('表侄', G.MALE, 1650);
R('姑', '表弟');
R('表弟', '表侄');
P('堂伯', G.MALE, 1585);
P('从堂哥', G.MALE, 1612);
R('伯祖', '堂伯');
R('堂伯', '从堂哥');
P('表叔', G.MALE, 1595);
R('姑婆', '表叔');
// Mother's line: 外曾祖 → {外公, 外叔公}; 外叔公 → 堂舅
P('外公', G.MALE, 1565);
P('外曾祖', G.MALE, 1535);
P('外叔公', G.MALE, 1570);
P('堂舅', G.MALE, 1598);
R('外公', '母');
R('外曾祖', '外公');
R('外曾祖', '外叔公');
R('外叔公', '堂舅');

const term = (to: string) => calculateDetailedRelationship('我', to, persons, relationships).term;

describe('collateral blood relatives', () => {
  it('names the descendants of siblings by the sibling’s sex', () => {
    expect(term('侄')).toBe('侄子');
    expect(term('侄孙')).toBe('侄孙');
    expect(term('外甥女')).toBe('外甥女');
    // relationship.js's word (the old engine said 外甥孙)
    expect(term('外甥孙')).toBe('甥外孙');
  });

  it('tells 堂 from 表 by the linking persons', () => {
    expect(term('堂兄')).toBe('堂哥');
    // relationship.js names the side: a father's sister's son (the old engine said 表弟)
    expect(term('表弟')).toBe('姑表弟');
    expect(term('堂侄女')).toBe('堂侄女');
    expect(term('表侄')).toBe('表侄');
  });

  it('names the cousins of parents, and second cousins', () => {
    expect(term('堂伯')).toBe('堂伯');
    // Formal, with the side: a father's father's sister's son (the old engine said 表叔)
    expect(term('表叔')).toBe('姑表叔父');
    expect(term('堂舅')).toBe('堂舅');
    expect(term('从堂哥')).toBe('从堂兄');
  });
});
