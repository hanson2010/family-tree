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

describe('a man with several wives', () => {
  it('keeps each wife’s children together, in the order of the wives, oldest first within each', () => {
    const people: Person[] = [];
    const rels: Relationship[] = [];
    const add = (id: string, gender: G, birthYear: number | null, relativeGeneration: number) =>
      people.push({ id, name: id, gender, birthYear, relativeGeneration, isPrivate: false, createdBy: 'u', createdAt: '', updatedAt: '' });
    const link = (a: string, b: string, type = T.PARENT_CHILD, startYear: number | null = null) =>
      rels.push({ id: `${a}-${b}`, personAId: a, personBId: b, type, startYear, createdBy: 'u', createdAt: '', updatedAt: '' });
    add('叶剑英', G.MALE, 1897, 0);
    add('冯华', G.FEMALE, 1900, 0);
    add('吴博', G.FEMALE, 1917, 0);
    add('李刚', G.FEMALE, 1915, 0);
    link('冯华', '叶剑英', T.SPOUSE, 1920);
    link('吴博', '叶剑英', T.SPOUSE, 1940);
    link('李刚', '叶剑英', T.SPOUSE, 1942);
    // Born in an order that mixes the mothers
    const children: [string, string | null, number][] = [
      ['叶选平', '冯华', 1924], ['戴晴', null, 1941], ['叶文珊', '李刚', 1943], ['叶向真', '吴博', 1944], ['叶楚梅', '冯华', 1946], ['叶选廉', '李刚', 1949],
    ];
    for (const [child, mother, year] of children) {
      add(child, G.FEMALE, year, 1);
      link('叶剑英', child);
      if (mother) link(mother, child);
    }
    const { positions } = layoutFamilyTree(people, rels);
    const order = children.map(([id]) => id).sort((a, b) => positions.get(a)!.x - positions.get(b)!.x);
    expect(order).toEqual(['戴晴', '叶选平', '叶楚梅', '叶向真', '叶文珊', '叶选廉']);
  });
});

describe('a wife and concubines', () => {
  // 贾琏: wife 王熙凤 (1722), concubines 平儿 (no date, born 1713), 尤二姐 (1733, born 1715), 秋桐 (1733, born 1717)
  const people: Person[] = [];
  const links: Relationship[] = [];
  const add = (id: string, gender: G, birthYear: number) =>
    people.push({ ...persons[0], id, name: id, gender, birthYear, relativeGeneration: 0 });
  const join = (woman: string, type: T, startYear: number | null) =>
    links.push({ ...relationships[0], id: `j${links.length}`, personAId: woman, personBId: '贾琏', type, startYear });
  add('贾琏', G.MALE, 1705);
  add('王熙凤', G.FEMALE, 1708);
  add('平儿', G.FEMALE, 1713);
  add('尤二姐', G.FEMALE, 1715);
  add('秋桐', G.FEMALE, 1717);
  join('秋桐', T.CONCUBINE, 1733);
  join('尤二姐', T.CONCUBINE, 1733);
  join('平儿', T.CONCUBINE, null);
  join('王熙凤', T.SPOUSE, 1722);

  const outward = (order: string[], rels: Relationship[]) => {
    const { positions } = layoutFamilyTree(people, rels);
    const husband = positions.get('贾琏')!.x;
    const distances = order.map((id) => Math.abs(positions.get(id)!.x - husband));
    return distances.join() === [...distances].sort((a, b) => a - b).join();
  };

  it('stand outward from the husband by start date, else by birth, as the kinship terms order them', () => {
    expect(outward(['王熙凤', '平儿', '尤二姐', '秋桐'], links)).toBe(true);
  });

  it('put a concubine who joined before the wife nearer the husband', () => {
    const early = links.map((r) => (r.personAId === '秋桐' ? { ...r, startYear: 1720 } : r));
    expect(outward(['秋桐', '王熙凤', '尤二姐'], early)).toBe(true);
  });
});
