import { describe, expect, it } from 'vitest';
import { planMerge } from '../merge';
import type { Relationship } from '@/types';
import { RelationshipType } from '@/types';

const rel = (id: string, a: string, b: string, type = RelationshipType.SPOUSE): Relationship => ({
  id,
  personAId: a,
  personBId: b,
  type,
  createdBy: 'u',
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('planMerge', () => {
  // 蒋中正 (remove) is merged into 蒋介石 (keep); both are married to 宋美龄
  const relationships = [
    rel('r1', 'meiling', 'jieshi'),
    rel('r2', 'meiling', 'zhongzheng'),
    rel('r3', 'zhongzheng', 'jingguo', RelationshipType.PARENT_CHILD),
    rel('r4', 'father', 'jieshi', RelationshipType.PARENT_CHILD),
  ];

  it('moves the removed person’s relationships to the kept one', () => {
    const { moved } = planMerge('jieshi', 'zhongzheng', relationships);
    expect(moved.map((r) => [r.id, r.personAId, r.personBId])).toEqual([['r3', 'jieshi', 'jingguo']]);
  });

  it('drops a relationship the kept person already has', () => {
    expect(planMerge('jieshi', 'zhongzheng', relationships).dropped).toEqual(['r2']);
  });

  it('drops a relationship between the two persons', () => {
    const between = [rel('r5', 'jieshi', 'zhongzheng', RelationshipType.SWORN_SIBLING)];
    expect(planMerge('jieshi', 'zhongzheng', between)).toEqual({ moved: [], dropped: ['r5'] });
  });

  it('keeps only one of two moved relationships that become the same', () => {
    const twice = [rel('a', 'zhongzheng', 'x'), rel('b', 'x', 'zhongzheng')];
    const plan = planMerge('jieshi', 'zhongzheng', twice);
    expect(plan.moved.map((r) => r.id)).toEqual(['a']);
    expect(plan.dropped).toEqual(['b']);
  });
});
