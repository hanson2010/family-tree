import { RelationshipType, type Person, type Relationship } from '@/types';
import { siblingKindFromParents } from '@/lib/sibling-kind';
import { GenerationCalculator } from '@/lib/generation-calculator';
import { connectFiltered } from '@/lib/tree-filter';
import { aliases } from '@/lib/person-identity';
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
  /** Where to look first: the middle of the largest tree, or of the single matches without trees */
  focus: { x: number; y: number };
}

/** The strings of a search: the query split at 、 and commas (，or ,), in lower case, without repeats */
export function searchTerms(query: string): string[] {
  return [...new Set(query.split(/[、，,]/).map((term) => term.trim().toLowerCase()).filter(Boolean))];
}

type Names = Pick<Person, 'name' | 'courtesyName' | 'artName' | 'otherNames'>;

/**
 * The terms that a name the person goes by contains (any case): their name, 字, 号, the 字 or 号
 * after the surname (蒋介石 for 蒋中正), or one of their other names
 */
function termsMatched(person: Names, terms: string[]): string[] {
  const names = aliases(person).map((n) => n.toLowerCase());
  return terms.filter((term) => names.some((n) => n.includes(term)));
}

/** Each person's relatives through the relationships between `persons` */
function neighboursOf(persons: Person[], relationships: Relationship[]): Map<string, string[]> {
  const ids = new Set(persons.map((p) => p.id));
  const neighbours = new Map<string, string[]>();
  for (const r of relationships) {
    if (!ids.has(r.personAId) || !ids.has(r.personBId)) continue;
    neighbours.set(r.personAId, [...(neighbours.get(r.personAId) ?? []), r.personBId]);
    neighbours.set(r.personBId, [...(neighbours.get(r.personBId) ?? []), r.personAId]);
  }
  return neighbours;
}

/** The families (persons connected through relationships) of `ids`, one per family, in order */
function familiesOf(ids: string[], neighbours: Map<string, string[]>): Set<string>[] {
  const seen = new Set<string>();
  const families: Set<string>[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const family = new Set<string>([id]);
    const queue = [id];
    while (queue.length > 0) {
      for (const next of neighbours.get(queue.shift()!) ?? []) {
        if (!family.has(next)) {
          family.add(next);
          queue.push(next);
        }
      }
    }
    family.forEach((member) => seen.add(member));
    families.push(family);
  }
  return families;
}

/**
 * The persons a search finds among `candidates` (those passing the filters): each one matching one
 * of the query's strings. With several strings (「贾政、王夫人」), only the matches in families where
 * every string is matched are kept, by one person or several; families are formed through all
 * `persons` and their `relationships`.
 */
export function searchMatches(
  persons: Person[],
  relationships: Relationship[],
  candidates: Person[],
  query: string
): Person[] {
  const terms = searchTerms(query);
  const matched = new Map<string, string[]>();
  for (const person of candidates) {
    const found = termsMatched(person, terms);
    if (found.length > 0) matched.set(person.id, found);
  }
  const matches = candidates.filter((p) => matched.has(p.id));
  if (terms.length < 2) return matches;

  const kept = new Set<string>();
  for (const family of familiesOf([...matched.keys()], neighboursOf(persons, relationships))) {
    const inFamily = [...matched.keys()].filter((id) => family.has(id));
    const found = new Set(inFamily.flatMap((id) => matched.get(id)!));
    if (found.size === terms.length) inFamily.forEach((id) => kept.add(id));
  }
  return matches.filter((p) => kept.has(p.id));
}

/**
 * Add to a tree the parents of half siblings in it: two persons drawn with a shared parent who are
 * 同父异母 or 同母异父 (sibling-kind.ts) would otherwise look like full siblings, so each one's
 * other parent is drawn too, as a connector. Returns the persons added.
 */
function addHalfSiblingParents(ids: Set<string>, relationships: Relationship[]): string[] {
  const parentsOf = new Map<string, string[]>();
  for (const r of relationships) {
    if (r.type === RelationshipType.PARENT_CHILD) {
      parentsOf.set(r.personBId, [...(parentsOf.get(r.personBId) ?? []), r.personAId]);
    }
  }
  const childrenIn = new Map<string, string[]>();
  for (const id of ids) {
    for (const parentId of parentsOf.get(id) ?? []) {
      if (ids.has(parentId)) childrenIn.set(parentId, [...(childrenIn.get(parentId) ?? []), id]);
    }
  }
  const added: string[] = [];
  for (const children of childrenIn.values()) {
    children.forEach((a, i) =>
      children.slice(i + 1).forEach((b) => {
        const parentsA = parentsOf.get(a) ?? [];
        const parentsB = parentsOf.get(b) ?? [];
        if (siblingKindFromParents(parentsA, parentsB) !== 'half') return;
        for (const parentId of [...parentsA, ...parentsB]) {
          if (!ids.has(parentId)) {
            ids.add(parentId);
            added.push(parentId);
          }
        }
      })
    );
  }
  return added;
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

  // The family (connected group of persons) of each match
  const families = familiesOf(
    shown.map((p) => p.id),
    neighboursOf(persons, usable)
  );

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
    addHalfSiblingParents(tree.ids, usable).forEach((id) => tree.connectorIds.add(id));
    trees.push({ rootId: inFamily[0].id, ...tree, matches: inFamily.length });
  });
  trees.sort((a, b) => b.matches - a.matches || b.ids.size - a.ids.size);

  const positions = new Map<string, { x: number; y: number }>();
  const connectorIds = new Set<string>();
  let cursor = 0;
  let focus: { x: number; y: number } | null = null;
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
    const maxY = Math.max(...points.map((p) => p.y));
    layout.forEach((p, id) => positions.set(id, { x: p.x - minX + cursor, y: p.y - minY }));
    focus ??= { x: cursor + (maxX - minX) / 2, y: (maxY - minY) / 2 };
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

  if (!focus) {
    const rows = Math.ceil(singles.length / columns);
    focus = {
      x: cursor + ((Math.min(columns, singles.length) - 1) * options.nodeSpacing * 1.4) / 2,
      y: (Math.max(rows, 1) - 1) * options.generationHeight / 2,
    };
  }

  return { total: matches.length, matchIds, connectorIds, positions, focus };
}
