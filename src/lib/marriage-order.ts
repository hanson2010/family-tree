import type { Person, Relationship } from '@/types';
import { RelationshipType } from '@/types';

type Birth = Pick<Person, 'birthYear'>;

/**
 * Which of two unions began first (negative: `a`): by start year; within the same year by month
 * and day when both give them; otherwise (a date missing on either) by the partners' birth years,
 * `partnerA` being `a`'s partner. 0 when nothing tells.
 */
export function compareUnionStart(a: Relationship, b: Relationship, partnerA?: Birth, partnerB?: Birth): number {
  const compare = (x?: number | null, y?: number | null) => (x != null && y != null && x !== y ? x - y : 0);
  if (a.startYear != null && b.startYear != null) {
    if (a.startYear !== b.startYear) return a.startYear - b.startYear;
    const byDay = compare(a.startMonth, b.startMonth) || compare(a.startDay, b.startDay);
    if (byDay) return byDay;
  }
  return compare(partnerA?.birthYear, partnerB?.birthYear);
}

/** Relationships counted as marriages when numbering a person's marriages */
export const MARRIAGE_TYPES: RelationshipType[] = [RelationshipType.SPOUSE, RelationshipType.CONCUBINE];

/**
 * A person's unions in one consistent order, as a sort by compareUnionStart cannot promise when
 * only some are dated: the dated ones by start date, the undated ones by their partners' birth
 * years, the two merged so that an undated union goes before the first dated one whose partner
 * was born later. `tie` orders whatever these leave equal.
 */
export function orderUnions<T>(
  items: T[],
  union: (item: T) => Relationship,
  partner: (item: T) => Birth | undefined,
  tie: (a: T, b: T) => number
): T[] {
  const birth = (item: T) => partner(item)?.birthYear ?? null;
  const dated = items
    .filter((item) => union(item).startYear != null)
    .sort((a, b) => compareUnionStart(union(a), union(b), partner(a), partner(b)) || tie(a, b));
  const undated = items
    .filter((item) => union(item).startYear == null)
    .sort((a, b) => {
      const x = birth(a);
      const y = birth(b);
      return (x != null && y != null ? x - y : x != null ? -1 : y != null ? 1 : 0) || tie(a, b);
    });
  const ordered: T[] = [];
  while (dated.length > 0 && undated.length > 0) {
    const u = birth(undated[0]);
    const d = birth(dated[0]);
    ordered.push(u != null && d != null && u < d ? undated.shift()! : dated.shift()!);
  }
  return [...ordered, ...dated, ...undated];
}

export interface MarriageOrdinal {
  /** The person whose marriages are counted */
  personId: string;
  /** 1 for their first marriage by start date, 2 for the second, … */
  ordinal: number;
}

/**
 * For each marriage, its place among each partner's marriages, by start date (compareUnionStart,
 * using the birth years in `persons`). Only marriages with a start year are numbered, and only for
 * persons with at least two of them.
 */
export function marriageOrdinals(
  relationships: Relationship[],
  persons: Map<string, Birth> = new Map()
): Map<string, MarriageOrdinal[]> {
  const marriages = relationships.filter((r) => MARRIAGE_TYPES.includes(r.type));
  const byPerson = new Map<string, Relationship[]>();
  marriages.forEach((r) =>
    [r.personAId, r.personBId].forEach((id) => byPerson.set(id, [...(byPerson.get(id) ?? []), r]))
  );

  const result = new Map<string, MarriageOrdinal[]>();
  byPerson.forEach((list, personId) => {
    const dated = list.filter((r) => r.startYear != null);
    if (dated.length < 2) return;
    const partner = (r: Relationship) => persons.get(r.personAId === personId ? r.personBId : r.personAId);
    dated
      .sort(
        (a, b) =>
          compareUnionStart(a, b, partner(a), partner(b)) ||
          (a.startMonth ?? 0) - (b.startMonth ?? 0) ||
          (a.startDay ?? 0) - (b.startDay ?? 0)
      )
      .forEach((r, i) => result.set(r.id, [...(result.get(r.id) ?? []), { personId, ordinal: i + 1 }]));
  });
  return result;
}
