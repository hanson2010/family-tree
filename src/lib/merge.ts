import type { Relationship } from '@/types';

export interface MergePlan {
  /** Relationships of the removed person, now pointing at the kept one */
  moved: Relationship[];
  /** Ids of relationships deleted: between the two persons, or already held by the kept one */
  dropped: string[];
}

const signature = (r: Pick<Relationship, 'type' | 'personAId' | 'personBId'>) =>
  `${r.type}|${[r.personAId, r.personBId].sort().join('|')}`;

/**
 * How relationships change when `removeId` is merged into `keepId`. `relationships` holds those
 * of both persons. The removed person's relationships move to the kept one, except those between
 * the two persons and those the kept person already has (same type and other person).
 */
export function planMerge(keepId: string, removeId: string, relationships: Relationship[]): MergePlan {
  const swap = (id: string) => (id === removeId ? keepId : id);
  const kept = new Set(
    relationships.filter((r) => r.personAId !== removeId && r.personBId !== removeId).map(signature)
  );

  const moved: Relationship[] = [];
  const dropped: string[] = [];
  relationships
    .filter((r) => r.personAId === removeId || r.personBId === removeId)
    .forEach((r) => {
      const next = { ...r, personAId: swap(r.personAId), personBId: swap(r.personBId) };
      if (next.personAId === next.personBId || kept.has(signature(next))) {
        dropped.push(r.id);
        return;
      }
      kept.add(signature(next));
      moved.push(next);
    });
  return { moved, dropped };
}
