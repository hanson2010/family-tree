import type { Relationship } from '@/types';

export interface FilteredTree {
  /** Persons to draw: the selected person, matching persons, and the connectors between them */
  ids: Set<string>;
  /** Persons drawn only to keep the tree connected; they do not match the filters */
  connectorIds: Set<string>;
}

/**
 * The persons to draw when filters are on, as one connected tree around `rootId`. Each matching
 * person is joined to the root along the route with the fewest non-matching persons, and those
 * persons are added as connectors. Only persons in `candidateIds` are used; a matching person
 * who cannot be reached through them is left out.
 */
export function connectFiltered(
  rootId: string,
  candidateIds: Set<string>,
  matchingIds: Set<string>,
  relationships: Relationship[]
): FilteredTree {
  const neighbours = new Map<string, string[]>();
  const link = (a: string, b: string) => neighbours.set(a, [...(neighbours.get(a) ?? []), b]);
  relationships.forEach((r) => {
    if (candidateIds.has(r.personAId) && candidateIds.has(r.personBId)) {
      link(r.personAId, r.personBId);
      link(r.personBId, r.personAId);
    }
  });

  // 0-1 breadth-first search: stepping onto a non-matching person costs 1, a matching one 0
  const cost = new Map<string, number>([[rootId, 0]]);
  const previous = new Map<string, string>();
  const queue: string[] = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const next of neighbours.get(id) ?? []) {
      const step = matchingIds.has(next) ? 0 : 1;
      const total = cost.get(id)! + step;
      if (total < (cost.get(next) ?? Number.POSITIVE_INFINITY)) {
        cost.set(next, total);
        previous.set(next, id);
        if (step === 0) queue.unshift(next);
        else queue.push(next);
      }
    }
  }

  const ids = new Set<string>([rootId]);
  matchingIds.forEach((id) => {
    if (!cost.has(id)) return;
    for (let at: string | undefined = id; at && !ids.has(at); at = previous.get(at)) ids.add(at);
  });
  const connectorIds = new Set([...ids].filter((id) => id !== rootId && !matchingIds.has(id)));
  return { ids, connectorIds };
}
