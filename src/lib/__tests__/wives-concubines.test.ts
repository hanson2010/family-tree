import { describe, expect, it } from 'vitest';
import { calculateDetailedRelationship } from '../chinese-kinship';
import { Gender, RelationshipType as T, type Person, type Relationship } from '@/types';

const P = (id: string, gender: Gender, birthYear: number): Person => ({
  id,
  name: id,
  gender,
  birthYear,
  isPrivate: false,
  createdBy: 'u',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});
let n = 0;
const R = (a: string, b: string, type: T, startYear?: number): Relationship => ({
  id: `r${n++}`,
  personAId: a,
  personBId: b,
  type,
  startYear: startYear ?? null,
  createdBy: 'u',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

// 贾政 with wife 王夫人 and concubines 赵姨娘 (joined 1712) and 周姨娘 (joined 1714, born earlier)
const persons = [
  P('贾政', Gender.MALE, 1685), P('王夫人', Gender.FEMALE, 1688), P('赵姨娘', Gender.FEMALE, 1695), P('周姨娘', Gender.FEMALE, 1690),
  P('贾宝玉', Gender.MALE, 1715), P('贾探春', Gender.FEMALE, 1717),
  P('贾赦', Gender.MALE, 1680), P('原配', Gender.FEMALE, 1682), P('邢夫人', Gender.FEMALE, 1700),
];
const relationships = [
  R('王夫人', '贾政', T.SPOUSE, 1705), R('赵姨娘', '贾政', T.CONCUBINE, 1712), R('周姨娘', '贾政', T.CONCUBINE, 1714),
  R('贾政', '贾宝玉', T.PARENT_CHILD), R('王夫人', '贾宝玉', T.PARENT_CHILD),
  R('贾政', '贾探春', T.PARENT_CHILD), R('赵姨娘', '贾探春', T.PARENT_CHILD),
  R('原配', '贾赦', T.SPOUSE, 1700), R('邢夫人', '贾赦', T.SPOUSE, 1720),
];
const term = (from: string, to: string) => calculateDetailedRelationship(from, to, persons, relationships).term;

describe('wives and concubines', () => {
  it('between a wife and a concubine', () => {
    expect(term('赵姨娘', '王夫人')).toBe('主母');
    expect(term('王夫人', '赵姨娘')).toBe('侧室');
  });

  it('between concubines, by who joined first', () => {
    expect(term('周姨娘', '赵姨娘')).toBe('姐姐');
    expect(term('赵姨娘', '周姨娘')).toBe('妹妹');
  });

  it('between two wives, by marriage order', () => {
    expect(term('邢夫人', '原配')).toBe('原配');
    expect(term('原配', '邢夫人')).toBe('继室');
  });

  it('between the women and the children of another of them', () => {
    expect(term('贾探春', '王夫人')).toBe('嫡母');
    expect(term('贾宝玉', '赵姨娘')).toBe('庶母');
    expect(term('王夫人', '贾探春')).toBe('庶女');
    expect(term('赵姨娘', '贾宝玉')).toBe('嫡子');
  });

  it('leaves a child and their own mother and father alone', () => {
    expect(term('贾探春', '赵姨娘')).toBe('母亲');
    expect(term('贾政', '贾探春')).toBe('女儿');
  });
});
