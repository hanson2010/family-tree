import { describe, expect, it } from 'vitest';
import { calculateDetailedRelationship } from '../chinese-kinship';
import { Gender as G, RelationshipType as T, type Person, type Relationship } from '@/types';

const persons: Person[] = [];
const relationships: Relationship[] = [];
let n = 0;
const P = (id: string, gender: G, birthYear: number | null) =>
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

// 我 (man) married 妻 (b. 1982). Her parents' children: 内兄 1978, 内弟 1985, 大姨子 1979, 小姨子 1988, and
// 无年舅 (no birth year). Each is married.
P('我', G.MALE, 1980);
P('妻', G.FEMALE, 1982);
P('岳父', G.MALE, 1955);
P('岳母', G.FEMALE, 1957);
R('妻', '我', T.SPOUSE);
R('岳母', '岳父', T.SPOUSE);
const wifeSiblings: [string, G, number | null, string, G][] = [
  ['内兄', G.MALE, 1978, '舅嫂', G.FEMALE],
  ['内弟', G.MALE, 1985, '内弟媳', G.FEMALE],
  ['大姨子', G.FEMALE, 1979, '襟兄', G.MALE],
  ['小姨子', G.FEMALE, 1988, '襟弟', G.MALE],
  ['无年舅', G.MALE, null, '无年舅妻', G.FEMALE],
];
for (const [sibling, sex, year, spouse, spouseSex] of wifeSiblings) {
  P(sibling, sex, year);
  P(spouse, spouseSex, 1980);
  R('岳父', sibling);
  R('岳母', sibling);
  R(sex === G.FEMALE ? sibling : spouse, sex === G.FEMALE ? spouse : sibling, T.SPOUSE);
}
for (const child of ['妻']) {
  R('岳父', child);
  R('岳母', child);
}

const term = (from: string, to: string) => calculateDetailedRelationship(from, to, persons, relationships).term;

describe("spouses of a spouse's siblings", () => {
  it("on the wife's side", () => {
    expect(term('我', '舅嫂')).toBe('舅嫂');
    expect(term('我', '内弟媳')).toBe('内弟媳');
    expect(term('我', '襟兄')).toBe('襟兄');
    expect(term('我', '襟弟')).toBe('襟弟');
  });

  it("on the husband's side, read the other way", () => {
    // 内弟媳's husband 内弟 is younger than his sister 妻, whose husband is 我: her husband's elder sister's husband
    expect(term('内弟媳', '我')).toBe('姐夫');
    // 舅嫂's husband 内兄 is older than his sister 妻: her husband's younger sister's husband
    expect(term('舅嫂', '我')).toBe('妹夫');
    // 舅嫂 and 内弟媳 are 妯娌: each the wife of her husband's brother
    expect(term('内弟媳', '舅嫂')).toBe('嫂子');
    expect(term('舅嫂', '内弟媳')).toBe('弟妹');
  });

  it('names both when the order is not known', () => {
    expect(term('我', '无年舅妻')).toBe('舅嫂/内弟媳');
    expect(term('襟兄', '襟弟')).toBe('襟弟');
  });
});
