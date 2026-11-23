import sharp from 'sharp';
import { z } from 'zod';
import type { Part } from '@google/genai';
import { generateJson, imagePart } from '@/lib/gemini';
import { Gender, RelationshipType } from '@/types';
import type { Extraction } from '@/lib/import';
import { MAX_OTHER_NAMES, MAX_OTHER_NAME_LENGTH, normalizeOtherNames } from '@/lib/other-names';

/** Longest side of a page image sent to Gemini; small characters in scans need detail */
const PAGE_SIZE = 3000;

const INSTRUCTIONS = `You read family records — Chinese genealogies (族谱, 家谱), biographies, notes or
lists — and extract the persons and the family relationships between them. Work only from the
given text and pages. Never invent persons, names, dates or relationships; leave unknown fields null.

Persons
- List each distinct person once, with a key "p1", "p2", … that relationships refer to.
- name: the full name as written. Genealogies often omit the clan surname for clan members; add it
  when the surname is clear from the record. Wives recorded only as "王氏" keep that form.
- courtesyName: 字. artName: 号.
- otherNames: other full names the person went by, as written (别名, 小名, 乳名, 曾用名, 法名,
  本名…), e.g. ["香菱"] for 甄英莲. Not the name, 字 or 号.
- gender: "male" for sons, husbands, 子, 男; "female" for daughters, wives, 女, 氏; otherwise "unknown".
- Years: give Gregorian years. Convert reign-era years (乾隆三年 → 1738) and 干支 years when the
  era is clear. Leave a year null if it cannot be determined.
- Month and day: only when the source gives them in the Gregorian calendar (公历/阳历). Leave them
  null for traditional lunar dates.
- note: the source's own short wording about the person (birth, death, burial, titles), at most 80
  characters, so a reviewer can check the dates.

Relationships (personAKey, personBKey, type)
- PARENT_CHILD: A is the parent, B the child. Record the mother as well when the record says who she is.
- SPOUSE: married partners, including 配, 娶, 元配, 继配, 继室.
- CONCUBINE: A is the husband, B the concubine (妾, 侧室, 庶室, 副室).
- BETROTHED: engaged (聘, 未婚).
- ADOPTIVE_PARENT: A adopted B, including an heir taken in (嗣子, 继子, 过继, 承嗣).
- FOSTER_PARENT: A fostered B.
- SIBLING / HALF_SIBLING / SWORN_SIBLING: only when stated and not already implied by shared parents.`;

const RELATIONSHIP_KEYS = {
  PARENT_CHILD: RelationshipType.PARENT_CHILD,
  SPOUSE: RelationshipType.SPOUSE,
  CONCUBINE: RelationshipType.CONCUBINE,
  BETROTHED: RelationshipType.BETROTHED,
  ADOPTIVE_PARENT: RelationshipType.ADOPTIVE_PARENT,
  FOSTER_PARENT: RelationshipType.FOSTER_PARENT,
  SIBLING: RelationshipType.SIBLING,
  HALF_SIBLING: RelationshipType.HALF_SIBLING,
  SWORN_SIBLING: RelationshipType.SWORN_SIBLING,
} as const;

const GENDERS = { male: Gender.MALE, female: Gender.FEMALE, unknown: Gender.UNKNOWN } as const;

const optionalInteger = { type: 'integer' };

const extractionSchema = {
  type: 'object',
  properties: {
    persons: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          name: { type: 'string' },
          courtesyName: { type: 'string' },
          artName: { type: 'string' },
          otherNames: { type: 'array', items: { type: 'string' } },
          gender: { type: 'string', enum: Object.keys(GENDERS) },
          birthYear: optionalInteger,
          birthMonth: optionalInteger,
          birthDay: optionalInteger,
          deathYear: optionalInteger,
          deathMonth: optionalInteger,
          deathDay: optionalInteger,
          note: { type: 'string' },
        },
        required: ['key', 'name', 'gender'],
      },
    },
    relationships: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          personAKey: { type: 'string' },
          personBKey: { type: 'string' },
          type: { type: 'string', enum: Object.keys(RELATIONSHIP_KEYS) },
        },
        required: ['personAKey', 'personBKey', 'type'],
      },
    },
  },
  required: ['persons', 'relationships'],
};

/** Whole numbers in range; anything else becomes null */
const loose = (min: number, max: number) =>
  z
    .unknown()
    .transform((v) => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null));
const text = z
  .unknown()
  .transform((v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined));
/** A list of names; anything that is not a name is dropped */
const names = z
  .unknown()
  .transform((v) =>
    normalizeOtherNames(Array.isArray(v) ? v.filter((n): n is string => typeof n === 'string') : [])
      .filter((n) => n.length <= MAX_OTHER_NAME_LENGTH)
      .slice(0, MAX_OTHER_NAMES)
  );

const extractionReply = z.object({
  persons: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      courtesyName: text,
      artName: text,
      otherNames: names,
      gender: z.unknown().transform((v) => GENDERS[v as keyof typeof GENDERS] ?? Gender.UNKNOWN),
      birthYear: loose(0, 2100),
      birthMonth: loose(1, 12),
      birthDay: loose(1, 31),
      deathYear: loose(0, 2100),
      deathMonth: loose(1, 12),
      deathDay: loose(1, 31),
      note: text,
    })
  ),
  relationships: z.array(z.object({ personAKey: z.string(), personBKey: z.string(), type: z.string() })),
});

export interface SourceFile {
  data: Buffer;
  mimeType: string;
}

async function filePart(file: SourceFile): Promise<Part> {
  if (file.mimeType === 'application/pdf') return imagePart(file.data, file.mimeType);
  const page = await sharp(file.data)
    .rotate()
    .resize(PAGE_SIZE, PAGE_SIZE, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 88 })
    .toBuffer();
  return imagePart(page, 'image/jpeg');
}

/** Persons and relationships found in the text and files; nothing is saved */
export async function extractFamily(sourceText: string, files: SourceFile[]): Promise<Extraction> {
  const parts: Part[] = [];
  if (sourceText.trim()) parts.push({ text: `Record text:\n${sourceText.trim()}` });
  for (const file of files) parts.push(await filePart(file));
  parts.push({ text: 'Extract the persons and relationships from the record above.' });

  const reply = extractionReply.parse(await generateJson(parts, extractionSchema, INSTRUCTIONS));

  const persons = reply.persons
    .filter((p, i, all) => p.name.trim() && all.findIndex((q) => q.key === p.key) === i)
    .map((p) => ({ ...p, name: p.name.trim() }));
  const keys = new Set(persons.map((p) => p.key));
  const relationships = reply.relationships
    .filter((r) => keys.has(r.personAKey) && keys.has(r.personBKey) && r.personAKey !== r.personBKey)
    .flatMap((r) => {
      const type = RELATIONSHIP_KEYS[r.type as keyof typeof RELATIONSHIP_KEYS];
      return type ? [{ personAKey: r.personAKey, personBKey: r.personBKey, type }] : [];
    });

  return { persons, relationships };
}
