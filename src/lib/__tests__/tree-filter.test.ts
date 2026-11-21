import { describe, expect, it } from 'vitest';
import { connectFiltered } from '../tree-filter';
import type { Relationship } from '@/types';
import { RelationshipType } from '@/types';

const rel = (a: string, b: string, type = RelationshipType.PARENT_CHILD): Relationship => ({
  id: `${a}-${b}`,
  personAId: a,
  personBId: b,
  type,
  createdBy: 'u',
  createdAt: new Date(),
  updatedAt: new Date(),
});

const sorted = (set: Set<string>) => [...set].sort();

describe('connectFiltered', () => {
  // grandma → mother → daughter; mother ↔ father (spouse); father → son
  const relationships = [
    rel('grandma', 'mother'),
    rel('mother', 'daughter'),
    rel('mother', 'father', RelationshipType.SPOUSE),
    rel('father', 'son'),
  ];
  const everyone = new Set(['grandma', 'mother', 'daughter', 'father', 'son']);

  it('adds the persons needed to reach each matching person as connectors', () => {
    // Men only, from the daughter: father and son are reached through the mother
    const result = connectFiltered('daughter', everyone, new Set(['father', 'son']), relationships);
    expect(sorted(result.ids)).toEqual(['daughter', 'father', 'mother', 'son']);
    expect(sorted(result.connectorIds)).toEqual(['mother']);
  });

  it('adds nothing when the matching persons are already connected', () => {
    const result = connectFiltered('grandma', everyone, new Set(['mother', 'daughter']), relationships);
    expect(sorted(result.ids)).toEqual(['daughter', 'grandma', 'mother']);
    expect(result.connectorIds.size).toBe(0);
  });

  it('prefers a route through matching persons', () => {
    // Two routes from root to target: through 'match' or through 'other'
    const rels = [rel('root', 'match'), rel('match', 'target'), rel('root', 'other'), rel('other', 'target')];
    const result = connectFiltered('root', new Set(['root', 'match', 'other', 'target']), new Set(['match', 'target']), rels);
    expect(sorted(result.ids)).toEqual(['match', 'root', 'target']);
  });

  it('leaves out matching persons reachable only outside the candidates', () => {
    const result = connectFiltered('daughter', new Set(['daughter', 'mother', 'son']), new Set(['son']), relationships);
    expect(sorted(result.ids)).toEqual(['daughter']);
  });
});
