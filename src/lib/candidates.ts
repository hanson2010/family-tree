import type { Person, Relationship } from '@/types';
import { Gender, RelationshipType } from '@/types';

/** What a person-picker slot expects, worked out from the persons already chosen */
export interface CandidateHint {
  gender?: Gender;
  /** Plausible birth years, inclusive */
  birthYears?: { from: number; to: number };
}

type Chosen = Pick<Person, 'gender' | 'birthYear'> | null | undefined;

// Plausible age gaps, in years
const PARENT_GAP = { min: 15, max: 60 };
const MOTHER_GAP = { min: 15, max: 50 };
const SPOUSE_GAP = 20;
const CONCUBINE_GAP = 30;
const SIBLING_GAP = 25;
const SWORN_SIBLING_GAP = 20;

const around = (year: number | null | undefined, gap: number) =>
  year == null ? undefined : { from: year - gap, to: year + gap };

/** Birth years a parent of someone born in `childYear` plausibly has */
const parentYears = (childYear: number | null | undefined, gap = PARENT_GAP) =>
  childYear == null ? undefined : { from: childYear - gap.max, to: childYear - gap.min };

/** Birth years a child of someone born in `parentYear` plausibly has */
const childYears = (parentYear: number | null | undefined, gap = PARENT_GAP) =>
  parentYear == null ? undefined : { from: parentYear + gap.min, to: parentYear + gap.max };

const intersect = (...ranges: ({ from: number; to: number } | undefined)[]) => {
  const known = ranges.filter((r): r is { from: number; to: number } => !!r);
  if (known.length === 0) return undefined;
  const from = Math.max(...known.map((r) => r.from));
  const to = Math.min(...known.map((r) => r.to));
  return from <= to ? { from, to } : undefined;
};

const opposite = (gender: Gender | undefined) =>
  gender === Gender.MALE ? Gender.FEMALE : gender === Gender.FEMALE ? Gender.MALE : undefined;

/** Hints for the father, mother and child slots of "Add Family Relationships" */
export function familyHints(father: Chosen, mother: Chosen, child: Chosen) {
  return {
    father: {
      gender: Gender.MALE,
      birthYears: parentYears(child?.birthYear) ?? around(mother?.birthYear, SPOUSE_GAP),
    },
    mother: {
      gender: Gender.FEMALE,
      birthYears: parentYears(child?.birthYear, MOTHER_GAP) ?? around(father?.birthYear, SPOUSE_GAP),
    },
    child: {
      birthYears: intersect(childYears(father?.birthYear), childYears(mother?.birthYear, MOTHER_GAP)),
    },
  } satisfies Record<string, CandidateHint>;
}

/** Hints for persons A and B of "Add Relationship", given the relationship type */
export function relationshipHints(type: RelationshipType, a: Chosen, b: Chosen): { a: CandidateHint; b: CandidateHint } {
  switch (type) {
    case RelationshipType.PARENT_CHILD:
    case RelationshipType.ADOPTIVE_PARENT:
    case RelationshipType.FOSTER_PARENT:
      return { a: { birthYears: parentYears(b?.birthYear) }, b: { birthYears: childYears(a?.birthYear) } };
    case RelationshipType.SPOUSE:
    case RelationshipType.BETROTHED:
      return {
        a: { gender: opposite(b?.gender), birthYears: around(b?.birthYear, SPOUSE_GAP) },
        b: { gender: opposite(a?.gender), birthYears: around(a?.birthYear, SPOUSE_GAP) },
      };
    case RelationshipType.CONCUBINE:
      // A is the concubine, B the husband
      return {
        a: { gender: Gender.FEMALE, birthYears: around(b?.birthYear, CONCUBINE_GAP) },
        b: { gender: Gender.MALE, birthYears: around(a?.birthYear, CONCUBINE_GAP) },
      };
    case RelationshipType.SIBLING:
    case RelationshipType.HALF_SIBLING:
      return { a: { birthYears: around(b?.birthYear, SIBLING_GAP) }, b: { birthYears: around(a?.birthYear, SIBLING_GAP) } };
    case RelationshipType.SWORN_SIBLING:
      return { a: { birthYears: around(b?.birthYear, SWORN_SIBLING_GAP) }, b: { birthYears: around(a?.birthYear, SWORN_SIBLING_GAP) } };
    default:
      return { a: {}, b: {} };
  }
}

/** Ids of persons in at least one relationship */
export function linkedPersonIds(relationships: Relationship[]): Set<string> {
  return new Set(relationships.flatMap((r) => [r.personAId, r.personBId]));
}

/**
 * Persons matching `query` (name, courtesy name or art name), best first: plausible for the
 * slot (gender and birth year fit, or are unknown), then unlinked before linked, then exact
 * gender, birth year in range, and name.
 */
export function rankCandidates(
  persons: Person[],
  options: { query?: string; excludeIds?: string[]; linkedIds: Set<string>; hint?: CandidateHint; limit?: number }
): Person[] {
  const { query = '', excludeIds = [], linkedIds, hint = {}, limit = 10 } = options;
  const q = query.trim().toLowerCase();
  const { gender, birthYears } = hint;

  const genderFit = (p: Person) =>
    !gender ? 0 : p.gender === gender ? 0 : p.gender === Gender.UNKNOWN ? 1 : 2;
  const yearFit = (p: Person) =>
    !birthYears ? 0 : p.birthYear == null ? 1 : p.birthYear >= birthYears.from && p.birthYear <= birthYears.to ? 0 : 2;
  const yearDistance = (p: Person) =>
    !birthYears || p.birthYear == null
      ? 0
      : Math.max(0, birthYears.from - p.birthYear, p.birthYear - birthYears.to);

  const key = (p: Person) => [
    genderFit(p) === 2 || yearFit(p) === 2 ? 1 : 0,
    linkedIds.has(p.id) ? 1 : 0,
    genderFit(p),
    yearFit(p),
    yearDistance(p),
  ];

  return persons
    .filter((p) => !excludeIds.includes(p.id))
    .filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        !!p.courtesyName?.toLowerCase().includes(q) ||
        !!p.artName?.toLowerCase().includes(q) ||
        !!p.otherNames?.some((n) => n.toLowerCase().includes(q))
    )
    .map((p) => ({ p, k: key(p) }))
    .sort((x, y) => {
      for (let i = 0; i < x.k.length; i++) if (x.k[i] !== y.k[i]) return x.k[i] - y.k[i];
      return x.p.name.localeCompare(y.p.name, 'zh-Hans-CN');
    })
    .slice(0, limit)
    .map(({ p }) => p);
}

/** Everyone reachable from `personId` through relationships, including them */
export function connectedPersonIds(personId: string, relationships: Relationship[]): Set<string> {
  const neighbours = new Map<string, string[]>();
  relationships.forEach((r) => {
    neighbours.set(r.personAId, [...(neighbours.get(r.personAId) ?? []), r.personBId]);
    neighbours.set(r.personBId, [...(neighbours.get(r.personBId) ?? []), r.personAId]);
  });
  const found = new Set([personId]);
  const queue = [personId];
  while (queue.length > 0) {
    for (const next of neighbours.get(queue.shift()!) ?? []) {
      if (!found.has(next)) {
        found.add(next);
        queue.push(next);
      }
    }
  }
  return found;
}
