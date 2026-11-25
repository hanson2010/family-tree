import { z } from 'zod';
import type { Person } from '@/types';
import { Gender, RelationshipType, personSchema } from '@/types';
import { isSamePerson } from '@/lib/person-identity';

/** A person found by Gemini, with a key that relationships refer to */
export interface ExtractedPerson {
  key: string;
  name: string;
  courtesyName?: string;
  artName?: string;
  otherNames?: string[];
  gender: Gender;
  birthYear: number | null;
  birthMonth: number | null;
  birthDay: number | null;
  deathYear: number | null;
  deathMonth: number | null;
  deathDay: number | null;
  /** The source's own wording about this person, to help review */
  note?: string;
}

export interface ExtractedRelationship {
  personAKey: string;
  personBKey: string;
  type: RelationshipType;
}

export interface Extraction {
  persons: ExtractedPerson[];
  relationships: ExtractedRelationship[];
}

/** One end of an imported relationship: a person being imported, or one already in the tree */
export const importRefSchema = z.union([
  z.object({ key: z.string().min(1) }),
  z.object({ id: z.string().min(1) }),
]);
export type ImportRef = z.infer<typeof importRefSchema>;

export const MAX_IMPORT_PERSONS = 200;
export const MAX_IMPORT_RELATIONSHIPS = 290;

export const importCommitSchema = z.object({
  isPrivate: z.boolean(),
  persons: z
    .array(personSchema.omit({ isPrivate: true, avatar: true }).extend({ key: z.string().min(1) }))
    .max(MAX_IMPORT_PERSONS),
  relationships: z
    .array(
      z.object({
        a: importRefSchema,
        b: importRefSchema,
        type: z.nativeEnum(RelationshipType),
        // Optional dates, e.g. of a marriage added with a family
        startYear: z.number().int().nullable().optional(),
        startMonth: z.number().int().min(1).max(12).nullable().optional(),
        startDay: z.number().int().min(1).max(31).nullable().optional(),
        endYear: z.number().int().nullable().optional(),
        endMonth: z.number().int().min(1).max(12).nullable().optional(),
        endDay: z.number().int().min(1).max(31).nullable().optional(),
      })
    )
    .max(MAX_IMPORT_RELATIONSHIPS),
});
export type ImportCommit = z.infer<typeof importCommitSchema>;

export interface ImportResult {
  personsCreated: number;
  relationshipsCreated: number;
  relationshipsSkipped: number;
}

/** What the review screen holds for each extracted person */
export interface ReviewPerson extends ExtractedPerson {
  include: boolean;
  /** 'new', or the id of an existing person this one is */
  match: string;
}

export interface ReviewRelationship extends ExtractedRelationship {
  include: boolean;
}

/**
 * The existing person an extracted one most likely is, with the same birth year when both have
 * one. A person with the same name comes first; otherwise one whose name, 字 or 号 (alone or after
 * the surname) equals the other's name, e.g. 蒋介石 and 蒋中正 (字 介石). Only an unambiguous
 * match counts.
 */
export function findExistingMatch(person: ExtractedPerson, existing: Person[]): Person | null {
  // Same rule as refusing duplicates: names match and birth dates do not tell them apart
  const same = existing.filter((p) => isSamePerson(person, p));
  const byName = same.filter((p) => p.name.trim() === person.name.trim());
  if (byName.length > 0) return byName.length === 1 ? byName[0] : null;
  return same.length === 1 ? same[0] : null;
}

export function toReview(extraction: Extraction, existing: Person[]): {
  persons: ReviewPerson[];
  relationships: ReviewRelationship[];
} {
  return {
    persons: extraction.persons.map((p) => ({
      ...p,
      include: true,
      match: findExistingMatch(p, existing)?.id ?? 'new',
    })),
    relationships: extraction.relationships.map((r) => ({ ...r, include: true })),
  };
}

/**
 * The save request for the reviewed data: new persons, and the relationships whose two ends
 * are both still included, pointing at existing persons where matched.
 */
export function buildCommit(
  persons: ReviewPerson[],
  relationships: ReviewRelationship[],
  isPrivate: boolean
): ImportCommit {
  const byKey = new Map(persons.map((p) => [p.key, p]));
  const ref = (key: string): ImportRef | null => {
    const p = byKey.get(key);
    if (!p || !p.include || !p.name.trim()) return null;
    return p.match === 'new' ? { key } : { id: p.match };
  };

  const newPersons = persons
    .filter((p) => p.include && p.match === 'new' && p.name.trim())
    .map(({ key, name, courtesyName, artName, otherNames, gender, birthYear, birthMonth, birthDay, deathYear, deathMonth, deathDay }) => ({
      key,
      name: name.trim(),
      courtesyName: courtesyName?.trim() || undefined,
      artName: artName?.trim() || undefined,
      otherNames: otherNames ?? [],
      gender,
      birthYear,
      birthMonth,
      birthDay,
      deathYear,
      deathMonth,
      deathDay,
    }));

  const seen = new Set<string>();
  const rels: ImportCommit['relationships'] = [];
  relationships.forEach((r) => {
    if (!r.include) return;
    const a = ref(r.personAKey);
    const b = ref(r.personBKey);
    if (!a || !b) return;
    const id = (x: ImportRef) => ('key' in x ? `k:${x.key}` : `i:${x.id}`);
    if (id(a) === id(b)) return;
    const signature = `${r.type}|${[id(a), id(b)].sort().join('|')}`;
    if (seen.has(signature)) return;
    seen.add(signature);
    rels.push({ a, b, type: r.type });
  });

  return { isPrivate, persons: newPersons, relationships: rels };
}
