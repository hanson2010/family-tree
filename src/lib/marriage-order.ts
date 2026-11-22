import type { Relationship } from '@/types';
import { RelationshipType } from '@/types';

/** Relationships counted as marriages when numbering a person's marriages */
export const MARRIAGE_TYPES: RelationshipType[] = [RelationshipType.SPOUSE, RelationshipType.CONCUBINE];

export interface MarriageOrdinal {
  /** The person whose marriages are counted */
  personId: string;
  /** 1 for their first marriage by start date, 2 for the second, … */
  ordinal: number;
}

/**
 * For each marriage, its place among each partner's marriages, by start date. Only marriages
 * with a start year are numbered, and only for persons with at least two of them.
 */
export function marriageOrdinals(relationships: Relationship[]): Map<string, MarriageOrdinal[]> {
  const marriages = relationships.filter((r) => MARRIAGE_TYPES.includes(r.type));
  const byPerson = new Map<string, Relationship[]>();
  marriages.forEach((r) =>
    [r.personAId, r.personBId].forEach((id) => byPerson.set(id, [...(byPerson.get(id) ?? []), r]))
  );

  const result = new Map<string, MarriageOrdinal[]>();
  byPerson.forEach((list, personId) => {
    const dated = list.filter((r) => r.startYear != null);
    if (dated.length < 2) return;
    dated
      .sort(
        (a, b) =>
          a.startYear! - b.startYear! ||
          (a.startMonth ?? 0) - (b.startMonth ?? 0) ||
          (a.startDay ?? 0) - (b.startDay ?? 0)
      )
      .forEach((r, i) => result.set(r.id, [...(result.get(r.id) ?? []), { personId, ordinal: i + 1 }]));
  });
  return result;
}
