import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { auth } from '@/lib/auth';
import { KINDS, getEntity, getFirestore, queryEntities } from '@/lib/firestore';
import { importCommitSchema, type ImportRef, type ImportResult } from '@/lib/import';
import { findVisibleDuplicate } from '@/lib/person-duplicates';
import type { ApiResponse, Person, Relationship } from '@/types';
import { Gender, RelationshipType } from '@/types';

const fail = (error: string, status: number) => NextResponse.json<ApiResponse<never>>({ success: false, error }, { status });

// POST /api/import/commit - Save reviewed persons and relationships in one batch
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return fail('Unauthorized', 401);

    const parsed = importCommitSchema.safeParse(await request.json());
    if (!parsed.success) return fail(parsed.error.message, 400);
    const { isPrivate, persons, relationships } = parsed.data;

    // Every relationship end must be a person in this import or one the user can see
    const keys = new Set(persons.map((p) => p.key));
    if (keys.size !== persons.length) return fail('Duplicate person keys.', 400);
    const existingIds = new Set(relationships.flatMap((r) => [r.a, r.b]).flatMap((x) => ('id' in x ? [x.id] : [])));
    const existing = new Map<string, Person>();
    for (const id of existingIds) {
      const person = await getEntity<Person>(KINDS.PERSON, id);
      if (!person || (person.isPrivate && person.createdBy !== userId)) return fail('Unknown person.', 400);
      existing.set(id, person);
    }
    if (relationships.some((r) => [r.a, r.b].some((x) => 'key' in x && !keys.has(x.key)))) {
      return fail('A relationship refers to a person not in the import.', 400);
    }

    // Same check as adding one person: no visible person with the same name and birth date
    const duplicates: string[] = [];
    for (const p of persons) {
      if (await findVisibleDuplicate(p, userId)) duplicates.push(p.name);
    }
    if (duplicates.length > 0) {
      return fail(`Already in the tree with the same birth date: ${duplicates.join(', ')}`, 409);
    }

    const now = new Date();
    const created = new Map<string, Person>(
      persons.map((p) => [
        p.key,
        {
          id: uuidv4(),
          name: p.name,
          courtesyName: p.courtesyName,
          artName: p.artName,
          gender: p.gender,
          birthYear: p.birthYear ?? null,
          birthMonth: p.birthMonth ?? null,
          birthDay: p.birthDay ?? null,
          deathYear: p.deathYear ?? null,
          deathMonth: p.deathMonth ?? null,
          deathDay: p.deathDay ?? null,
          avatar: null,
          isPrivate,
          createdBy: userId,
          createdAt: now,
          updatedAt: now,
        },
      ])
    );
    const resolve = (x: ImportRef): Person => ('key' in x ? created.get(x.key)! : existing.get(x.id)!);

    // Relationships between persons already in the tree may exist already
    const signature = (type: RelationshipType, a: string, b: string) => `${type}|${[a, b].sort().join('|')}`;
    const known = new Set<string>();
    if (relationships.some((r) => 'id' in r.a && 'id' in r.b)) {
      (await queryEntities<Relationship>(KINDS.RELATIONSHIP)).forEach((r) =>
        known.add(signature(r.type, r.personAId, r.personBId))
      );
    }

    const newRelationships: Relationship[] = [];
    let skipped = 0;
    for (const r of relationships) {
      let a = resolve(r.a);
      let b = resolve(r.b);
      if (a.id === b.id || known.has(signature(r.type, a.id, b.id))) {
        skipped++;
        continue;
      }
      known.add(signature(r.type, a.id, b.id));
      // Stored as elsewhere in the app: a wife as A in a marriage, the husband as A for a concubine
      const swap =
        (r.type === RelationshipType.SPOUSE &&
          ((b.gender === Gender.FEMALE && a.gender !== Gender.FEMALE) ||
            (a.gender === Gender.MALE && b.gender !== Gender.MALE))) ||
        (r.type === RelationshipType.CONCUBINE && b.gender === Gender.MALE && a.gender !== Gender.MALE);
      if (swap) [a, b] = [b, a];
      newRelationships.push({
        id: uuidv4(),
        personAId: a.id,
        personBId: b.id,
        type: r.type,
        startYear: null,
        startMonth: null,
        startDay: null,
        endYear: null,
        endMonth: null,
        endDay: null,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });
    }

    // One batch, so an import is saved completely or not at all
    const db = getFirestore();
    const batch = db.batch();
    created.forEach(({ id, ...data }) => batch.set(db.collection(KINDS.PERSON).doc(id), data));
    newRelationships.forEach(({ id, ...data }) => batch.set(db.collection(KINDS.RELATIONSHIP).doc(id), data));
    await batch.commit();

    return NextResponse.json<ApiResponse<ImportResult>>(
      {
        success: true,
        data: {
          personsCreated: created.size,
          relationshipsCreated: newRelationships.length,
          relationshipsSkipped: skipped,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error importing family records:', error);
    return fail('Failed to save the import', 500);
  }
}
