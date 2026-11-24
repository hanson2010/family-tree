import { describe, expect, it } from 'vitest';
import { siblingKindFromParents } from '../sibling-kind';
import { calculateDetailedRelationship } from '../chinese-kinship';
import { Gender as G, RelationshipType as T, type Person, type Relationship } from '@/types';

describe('siblingKindFromParents', () => {
  it('needs a shared parent', () => {
    expect(siblingKindFromParents(['f'], ['g'])).toBeNull();
  });

  it('calls children of the same parents full siblings', () => {
    expect(siblingKindFromParents(['f', 'm'], ['f', 'm'])).toBe('full');
  });

  it('does not take a missing parent as evidence of half siblings', () => {
    expect(siblingKindFromParents(['f', 'm'], ['f'])).toBe('full');
    expect(siblingKindFromParents(['f'], ['f'])).toBe('full');
  });

  it('calls them half siblings when each has a different other parent', () => {
    expect(siblingKindFromParents(['f', 'm1'], ['f', 'm2'])).toBe('half');
  });
});

describe('sibling terms', () => {
  const P = (id: string, gender: G, birthYear: number): Person => ({
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
  const R = (a: string, b: string): Relationship => ({
    id: `r${n++}`,
    personAId: a,
    personBId: b,
    type: T.PARENT_CHILD,
    createdBy: 'u',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  const persons = [P('贾政', G.MALE, 1685), P('王夫人', G.FEMALE, 1688), P('赵姨娘', G.FEMALE, 1695), P('贾珠', G.MALE, 1712), P('贾宝玉', G.MALE, 1715), P('贾环', G.MALE, 1720)];
  const term = (from: string, to: string, relationships: Relationship[]) =>
    calculateDetailedRelationship(from, to, persons, relationships).term;

  it('calls a brother with no mother recorded 大哥 (the eldest), not 同父异母哥哥', () => {
    expect(term('贾宝玉', '贾珠', [R('贾政', '贾珠'), R('贾政', '贾宝玉'), R('王夫人', '贾宝玉')])).toBe('大哥');
  });

  it('calls a brother with a different recorded mother 同父异母弟弟', () => {
    const relationships = [R('贾政', '贾宝玉'), R('王夫人', '贾宝玉'), R('贾政', '贾环'), R('赵姨娘', '贾环')];
    expect(term('贾宝玉', '贾环', relationships)).toBe('同父异母弟弟');
  });
});
