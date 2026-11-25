import { describe, expect, it } from 'vitest';
import { getChineseRelationshipLabel } from '../chinese-kinship';
import { Gender as G, RelationshipType as T, type Person, type Relationship } from '@/types';

const persons: Person[] = [];
const relationships: Relationship[] = [];
let n = 0;
const P = (id: string, gender: G, birthYear?: number) =>
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
// Fresh copies, as the app passes: a test below changes a birth year in place
const term = (from: string, to: string) => getChineseRelationshipLabel(from, to, [...persons], relationships);

// 曾麟书 → 曾国藩 (1811), 曾国荃 (1824); 曾国荃 → A → B → 曾昭和 → 曾宪植
P('曾麟书', G.MALE, 1790);
P('曾国藩', G.MALE, 1811);
P('曾国荃', G.MALE, 1824);
P('A', G.MALE);
P('B', G.MALE);
P('曾昭和', G.MALE);
P('曾宪植', G.FEMALE, 1910);
R('曾麟书', '曾国藩');
R('曾麟书', '曾国荃');
R('曾国荃', 'A');
R('A', 'B');
R('B', '曾昭和');
R('曾昭和', '曾宪植');

// 俞文葆 → 俞明震 (1860), 俞明颐 (1873), 俞明诗; 俞明震 → 俞大纯 (1883) → 俞启威 → 俞正声;
// 俞明颐 → 俞大维 (1897) → 俞扬和; 俞明诗 + 陈三立 → 陈新午, 陈寅恪; 陈新午 married 俞大维
P('俞文葆', G.MALE, 1830);
P('俞明震', G.MALE, 1860);
P('俞明颐', G.MALE, 1873);
P('俞明诗', G.FEMALE, 1865);
P('陈三立', G.MALE, 1853);
P('俞大纯', G.MALE, 1883);
P('俞启威', G.MALE, 1911);
P('俞正声', G.MALE, 1945);
P('俞大维', G.MALE, 1897);
P('俞扬和', G.MALE, 1920);
P('陈新午', G.FEMALE, 1894);
P('陈寅恪', G.MALE, 1890);
R('俞文葆', '俞明震');
R('俞文葆', '俞明颐');
R('俞文葆', '俞明诗');
R('俞明震', '俞大纯');
R('俞大纯', '俞启威');
R('俞启威', '俞正声');
R('俞明颐', '俞大维');
R('俞大维', '俞扬和');
R('俞明诗', '陈新午');
R('陈三立', '陈新午');
R('俞明诗', '陈寅恪');
R('陈三立', '陈寅恪');
R('俞明诗', '陈三立', T.SPOUSE);
R('陈新午', '俞大维', T.SPOUSE);

describe('relatives of distant generations', () => {
  it('names a great-great-grandfather’s brother 伯高祖父, not 高祖父', () => {
    expect(term('曾宪植', '曾国藩')).toBe('伯高祖父');
    expect(term('曾宪植', '曾国荃')).toBe('高祖父');
  });

  it('decides 伯 or 叔 against the ancestor of that generation', () => {
    // 曾国藩 is older than 曾昭和's great-grandfather 曾国荃
    expect(term('曾昭和', '曾国藩')).toBe('伯曾祖父');
    expect(term('曾国藩', '曾昭和')).toBe('侄曾孙');
  });

  it('keeps 堂 for a grandfather’s cousin, both ways', () => {
    expect(term('俞正声', '俞大维')).toBe('堂叔祖父');
    expect(term('俞大维', '俞正声')).toBe('堂侄孙');
  });
});

describe('step-parents', () => {
  it('names the father’s wife who is not the mother 继母, before any blood term', () => {
    expect(term('俞扬和', '陈新午')).toBe('继母');
    expect(term('陈新午', '俞扬和')).toBe('继子');
  });
});

describe('relatives linked more closely by marriage', () => {
  it('names a cousin who is one’s spouse as spouse', () => {
    expect(term('俞大维', '陈新午')).toBe('妻子');
    expect(term('陈新午', '俞大维')).toBe('丈夫');
  });

  it('names direct in-laws as in-laws', () => {
    expect(term('俞明诗', '俞大维')).toBe('女婿');
    expect(term('俞大维', '陈寅恪')).toBe('大舅子');
  });
});

describe('a spouse’s nephews', () => {
  it('follow the sibling they descend from', () => {
    // 俞明震's wife calls his brother's son 侄子; 陈三立 calls his wife's brother's son 内侄
    P('俞明震妻', G.FEMALE, 1862);
    R('俞明震妻', '俞明震', T.SPOUSE);
    P('俞明颐之子', G.MALE, 1900);
    R('俞明颐', '俞明颐之子');
    expect(term('俞明震妻', '俞明颐之子')).toBe('侄子');
    expect(term('陈三立', '俞明颐之子')).toBe('内侄');
  });
});

describe('a sibling’s spouse, the sibling recorded directly', () => {
  // 陈秋葵 is recorded as 陈赓's sister, without parents; 王根英 is his wife
  P('陈赓', G.MALE, 1903);
  P('陈秋葵', G.FEMALE);
  P('王根英', G.FEMALE, 1906);
  R('陈赓', '陈秋葵', T.SIBLING);
  R('王根英', '陈赓', T.SPOUSE);

  it('is 嫂子 or 弟妹, not a sister; both when the ages are unknown', () => {
    expect(term('陈秋葵', '王根英')).toBe('嫂子/弟妹');
    expect(term('王根英', '陈秋葵')).toBe('姑子');
    expect(term('陈秋葵', '陈赓')).toBe('哥哥/弟弟');
  });

  it('follows the sibling’s age once it is known', () => {
    persons.find((p) => p.id === '陈秋葵')!.birthYear = 1908;
    expect(term('陈秋葵', '王根英')).toBe('嫂子');
    expect(term('王根英', '陈秋葵')).toBe('小姑子');
    expect(term('陈秋葵', '陈赓')).toBe('哥哥');
  });
});

describe("a parent's brothers and sisters by birth order", () => {
  // 外祖父 + 外祖母 → 大姨 (1940), 母亲 (1943), 三姨 (1946), 幺姨 (1950), 舅 (1948); 母亲 + 父亲 → 我
  const people: Person[] = [];
  const links: Relationship[] = [];
  const add = (id: string, gender: G, birthYear?: number) =>
    people.push({ ...persons[0], id, name: id, gender, birthYear, birthMonth: undefined });
  const link = (a: string, b: string, type = T.PARENT_CHILD) => links.push({ ...relationships[0], id: `l${links.length}`, personAId: a, personBId: b, type });
  add('外祖父', G.MALE, 1915);
  add('外祖母', G.FEMALE, 1918);
  add('大姨', G.FEMALE, 1940);
  add('母亲', G.FEMALE, 1943);
  add('三姨', G.FEMALE, 1946);
  add('舅', G.MALE, 1948);
  add('幺姨', G.FEMALE, 1950);
  add('父亲', G.MALE, 1941);
  add('我', G.MALE, 1970);
  for (const child of ['大姨', '母亲', '三姨', '舅', '幺姨']) {
    link('外祖父', child);
    link('外祖母', child);
  }
  link('母亲', '父亲', T.SPOUSE);
  link('父亲', '我');
  link('母亲', '我');
  const say = (to: string, options = {}) => getChineseRelationshipLabel('我', to, [...people], links, options);

  it('numbers them, the parent included, in both styles', () => {
    expect([say('大姨'), say('三姨'), say('幺姨')]).toEqual(['大姨母', '三姨母', '小姨母']);
    expect([say('大姨', { style: 'casual' }), say('三姨', { style: 'casual' }), say('幺姨', { style: 'casual' })]).toEqual([
      '大姨',
      '三姨',
      '小姨',
    ]);
    expect(say('幺姨', { style: 'casual', region: 'northern' })).toBe('老姨');
  });

  it('leaves out the number when the order is not known', () => {
    // An only brother has no number; a sister without a birth date leaves her sisters unnumbered
    expect(say('舅')).toBe('舅父');
    const undated = people.find((p) => p.id === '三姨')!;
    undated.birthYear = undefined;
    expect(say('大姨')).toBe('姨母');
  });
});

describe('relatives through women beyond one 表', () => {
  // 贾母 and her brother 史公; 贾母 → 贾敏 → 林黛玉; 史公 → 史湘云之父 → 史湘云
  const people: Person[] = [];
  const links: Relationship[] = [];
  const add = (id: string, gender: G, birthYear: number) =>
    people.push({ ...persons[0], id, name: id, gender, birthYear, birthMonth: undefined });
  const link = (a: string, b: string, type = T.PARENT_CHILD) => links.push({ ...relationships[0], id: `b${links.length}`, personAId: a, personBId: b, type });
  add('贾母', G.FEMALE, 1660);
  add('史公', G.MALE, 1665);
  add('贾敏', G.FEMALE, 1690);
  add('史湘云之父', G.MALE, 1690);
  add('林黛玉', G.FEMALE, 1720);
  add('史湘云', G.FEMALE, 1721);
  link('贾母', '史公', T.SIBLING);
  link('贾母', '贾敏');
  link('史公', '史湘云之父');
  link('贾敏', '林黛玉');
  link('史湘云之父', '史湘云');
  const say = (from: string, to: string) => getChineseRelationshipLabel(from, to, [...people], links);

  it('are named with the plain 表, not a stack of 表', () => {
    expect(say('林黛玉', '史湘云')).toBe('表妹');
    expect(say('史湘云', '林黛玉')).toBe('表姐');
  });
});

describe("a cousin's spouse", () => {
  // 舅舅 → 表哥 (1968), 表弟 (1975), their wives; 母亲 → 我 (1970)
  const people: Person[] = [];
  const links: Relationship[] = [];
  const add = (id: string, gender: G, birthYear?: number) =>
    people.push({ ...persons[0], id, name: id, gender, birthYear, birthMonth: undefined });
  const link = (a: string, b: string, type = T.PARENT_CHILD) => links.push({ ...relationships[0], id: `c${links.length}`, personAId: a, personBId: b, type });
  add('母亲', G.FEMALE, 1945);
  add('舅舅', G.MALE, 1942);
  add('我', G.MALE, 1970);
  add('表哥', G.MALE, 1968);
  add('表嫂', G.FEMALE, 1972);
  add('表弟', G.MALE, 1975);
  add('表弟媳', G.FEMALE, 1974);
  add('无年表兄弟', G.MALE);
  add('无年表兄弟之妻', G.FEMALE, 1970);
  link('母亲', '舅舅', T.SIBLING);
  link('母亲', '我');
  for (const child of ['表哥', '表弟', '无年表兄弟']) link('舅舅', child);
  link('表嫂', '表哥', T.SPOUSE);
  link('表弟媳', '表弟', T.SPOUSE);
  link('无年表兄弟之妻', '无年表兄弟', T.SPOUSE);
  const say = (to: string) => getChineseRelationshipLabel('我', to, [...people], links);

  it("follows the cousin's age, not the spouse's", () => {
    // 表嫂 is younger than 我, but her husband is older
    expect(say('表嫂')).toBe('舅表嫂');
    expect(say('表弟媳')).toBe('舅表弟媳');
  });

  it("gives both when the cousin's age is not known", () => {
    expect(say('无年表兄弟之妻')).toBe('舅表嫂/舅表弟媳');
  });
});
