import type { Person, Relationship } from '@/types';
import { GenerationCalculator } from '@/lib/generation-calculator';
import { connectFiltered } from '@/lib/tree-filter';
import { DEFAULT_LAYOUT_OPTIONS, compareByBirth, layoutFamilyTree, type LayoutOptions } from '@/lib/tree-layout';

/**
 * Search results as a forest: matches in the same family form one tree, joined through the
 * fewest non-matching persons (connectors); each tree is laid out like the family tree and the
 * trees stand side by side, largest first. Matches related to no other match stand in a grid to
 * their right.
 */

/** Most matches drawn; a broader search says how many there are */
export const MAX_SEARCH_MATCHES = 100;

export interface SearchForest {
  /** All matches, before the limit */
  total: number;
  matchIds: Set<string>;
  connectorIds: Set<string>;
  /** Where each drawn person (match or connector) goes */
  positions: Map<string, { x: number; y: number }>;
}

/** Whether a person's name, 字, 号 or one of their other names contains the query (any case) */
export function matchesQuery(person: Pick<Person, 'name' | 'courtesyName' | 'artName' | 'otherNames'>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return [person.name, person.courtesyName, person.artName, ...(person.otherNames ?? [])].some((n) =>
    n?.toLowerCase().includes(q)
  );
}

/** Space between trees, and between the trees and the grid of single matches */
const TREE_GAP = 160;

/**
 * The forest for `matches` among `persons` (whom the user can see) and their `relationships`.
 * At most MAX_SEARCH_MATCHES matches are used: the oldest first.
 */
export function searchForest(
  persons: Person[],
  relationships: Relationship[],
  matches: Person[],
  options: LayoutOptions = DEFAULT_LAYOUT_OPTIONS
): SearchForest {
  const shown = [...matches].sort(compareByBirth).slice(0, MAX_SEARCH_MATCHES);
  const matchIds = new Set(shown.map((p) => p.id));
  const byId = new Map(persons.map((p) => [p.id, p]));
  const usable = relationships.filter((r) => byId.has(r.personAId) && byId.has(r.personBId));

  const neighbours = new Map<string, string[]>();
  usable.forEach((r) => {
    neighbours.set(r.personAId, [...(neighbours.get(r.personAId) ?? []), r.personBId]);
    neighbours.set(r.personBId, [...(neighbours.get(r.personBId) ?? []), r.personAId]);
  });

  // The family (connected group of persons) of each match
  const familyOf = new Map<string, number>();
  const families: Set<string>[] = [];
  for (const match of shown) {
    if (familyOf.has(match.id)) continue;
    const family = new Set<string>([match.id]);
    const queue = [match.id];
    while (queue.length > 0) {
      for (const next of neighbours.get(queue.shift()!) ?? []) {
        if (!family.has(next)) {
          family.add(next);
          queue.push(next);
        }
      }
    }
    family.forEach((id) => familyOf.set(id, families.length));
    families.push(family);
  }

  // One tree per family holding two or more matches; the rest are single matches
  const trees: { rootId: string; ids: Set<string>; connectorIds: Set<string>; matches: number }[] = [];
  const singles: Person[] = [];
  families.forEach((family) => {
    const inFamily = shown.filter((p) => family.has(p.id));
    if (inFamily.length < 2) {
      singles.push(...inFamily);
      return;
    }
    const tree = connectFiltered(inFamily[0].id, family, new Set(inFamily.map((p) => p.id)), usable);
    trees.push({ rootId: inFamily[0].id, ...tree, matches: inFamily.length });
  });
  trees.sort((a, b) => b.matches - a.matches || b.ids.size - a.ids.size);

  const positions = new Map<string, { x: number; y: number }>();
  const connectorIds = new Set<string>();
  let cursor = 0;
  for (const tree of trees) {
    const treeRelationships = usable.filter((r) => tree.ids.has(r.personAId) && tree.ids.has(r.personBId));
    const treePersons = [...tree.ids].map((id) => byId.get(id)!);
    const generations = new GenerationCalculator(treePersons, treeRelationships).calculateRelativeGenerations(tree.rootId);
    const layout = layoutFamilyTree(
      treePersons.map((p) => ({ ...p, relativeGeneration: generations.get(p.id) ?? 0 })),
      treeRelationships,
      options
    ).positions;
    const points = [...layout.values()];
    const minX = Math.min(...points.map((p) => p.x));
    const maxX = Math.max(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    layout.forEach((p, id) => positions.set(id, { x: p.x - minX + cursor, y: p.y - minY }));
    tree.connectorIds.forEach((id) => connectorIds.add(id));
    cursor += maxX - minX + TREE_GAP;
  }

  // Single matches in a roughly square grid, oldest first
  const columns = Math.max(1, Math.ceil(Math.sqrt(singles.length)));
  singles.sort(compareByBirth).forEach((p, i) => {
    positions.set(p.id, {
      x: cursor + (i % columns) * options.nodeSpacing * 1.4,
      y: Math.floor(i / columns) * options.generationHeight,
    });
  });

  return { total: matches.length, matchIds, connectorIds, positions };
}
