import { describe, expect, it } from 'vitest';
import { buildCommit, findExistingMatch, importCommitSchema, toReview, type ExtractedPerson } from '../import';
import type { Person } from '@/types';
import { Gender, RelationshipType } from '@/types';

const extracted = (key: string, name: string, birthYear: number | null = null): ExtractedPerson => ({
  key,
  name,
  gender: Gender.MALE,
  birthYear,
  birthMonth: null,
  birthDay: null,
  deathYear: null,
  deathMonth: null,
  deathDay: null,
});

const existing = (id: string, name: string, birthYear: number | null = null): Person => ({
  id,
  name,
  gender: Gender.MALE,
  birthYear,
  isPrivate: false,
  createdBy: 'u',
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('findExistingMatch', () => {
  it('matches the one existing person with the same name', () => {
    expect(findExistingMatch(extracted('p1', '贾政'), [existing('a', '贾政'), existing('b', '贾赦')])?.id).toBe('a');
  });

  it('needs the birth year to agree when both have one', () => {
    expect(findExistingMatch(extracted('p1', '贾政', 1700), [existing('a', '贾政', 1690)])).toBeNull();
    expect(findExistingMatch(extracted('p1', '贾政', 1700), [existing('a', '贾政')])?.id).toBe('a');
  });

  it('does not guess between several persons with the same name', () => {
    expect(findExistingMatch(extracted('p1', '贾政'), [existing('a', '贾政'), existing('b', '贾政')])).toBeNull();
  });

  it('matches a name against an existing courtesy or art name', () => {
    const zhongzheng = { ...existing('z', '蒋中正', 1887), courtesyName: '介石' };
    expect(findExistingMatch(extracted('p1', '蒋介石'), [zhongzheng])?.id).toBe('z');
    const baoyu = { ...existing('b', '贾宝玉'), artName: '怡红公子' };
    expect(findExistingMatch(extracted('p1', '怡红公子'), [baoyu])?.id).toBe('b');
  });

  it('matches an existing name against the found courtesy name', () => {
    const found = { ...extracted('p1', '蒋中正'), courtesyName: '介石' };
    expect(findExistingMatch(found, [existing('j', '介石')])?.id).toBe('j');
  });

  it('prefers the same name to a courtesy-name match', () => {
    const sameName = existing('a', '介石');
    const byCourtesy = { ...existing('b', '蒋中正'), courtesyName: '介石' };
    expect(findExistingMatch(extracted('p1', '介石'), [byCourtesy, sameName])?.id).toBe('a');
  });

  it('needs the birth year to agree for a courtesy-name match too', () => {
    const zhongzheng = { ...existing('z', '蒋中正', 1887), courtesyName: '介石' };
    expect(findExistingMatch(extracted('p1', '蒋介石', 1950), [zhongzheng])).toBeNull();
  });
});

describe('buildCommit', () => {
  const extraction = {
    persons: [extracted('p1', '贾政'), extracted('p2', '贾宝玉'), extracted('p3', '贾环')],
    relationships: [
      { personAKey: 'p1', personBKey: 'p2', type: RelationshipType.PARENT_CHILD },
      { personAKey: 'p1', personBKey: 'p3', type: RelationshipType.PARENT_CHILD },
      { personAKey: 'p1', personBKey: 'p2', type: RelationshipType.PARENT_CHILD },
    ],
  };

  it('creates unmatched persons and points relationships at matched ones', () => {
    const review = toReview(extraction, [existing('existing-zheng', '贾政')]);
    const commit = buildCommit(review.persons, review.relationships, true);
    expect(commit.isPrivate).toBe(true);
    expect(commit.persons.map((p) => p.key)).toEqual(['p2', 'p3']);
    expect(commit.relationships).toEqual([
      { a: { id: 'existing-zheng' }, b: { key: 'p2' }, type: RelationshipType.PARENT_CHILD },
      { a: { id: 'existing-zheng' }, b: { key: 'p3' }, type: RelationshipType.PARENT_CHILD },
    ]);
    expect(importCommitSchema.safeParse(commit).success).toBe(true);
  });

  it('drops relationships of excluded persons and unticked relationships', () => {
    const review = toReview(extraction, []);
    review.persons[2].include = false;
    review.relationships[0].include = false;
    const commit = buildCommit(review.persons, review.relationships, false);
    expect(commit.persons.map((p) => p.key)).toEqual(['p1', 'p2']);
    // The duplicate of the unticked first relationship is still kept
    expect(commit.relationships).toEqual([{ a: { key: 'p1' }, b: { key: 'p2' }, type: RelationshipType.PARENT_CHILD }]);
  });

  it('skips a relationship whose two ends became the same person', () => {
    const review = toReview(
      { persons: [extracted('p1', '甲'), extracted('p2', '乙')], relationships: [{ personAKey: 'p1', personBKey: 'p2', type: RelationshipType.SIBLING }] },
      []
    );
    review.persons[0].match = 'same';
    review.persons[1].match = 'same';
    expect(buildCommit(review.persons, review.relationships, false).relationships).toEqual([]);
  });
});
