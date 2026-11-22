import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { auth } from '@/lib/auth';
import { KINDS, getEntity, getFirestore, queryEntities } from '@/lib/firestore';
import { importCommitSchema, type ImportRef, type ImportResult } from '@/lib/import';
import { describe } from '@/lib/person-duplicates';
import { isSamePerson } from '@/lib/person-identity';
import type { ApiResponse, Person, Relationship } from '@/types';
import { RelationshipType } from '@/types';
import { shouldSwapPartners } from '@/lib/relationship-direction';

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

    // Public persons must not duplicate one already in the tree, nor another person in this import
    if (!isPrivate) {
      const visible = (await queryEntities<Person>(KINDS.PERSON)).filter((p) => !p.isPrivate || p.createdBy === userId);
      const problems: string[] = [];
      persons.forEach((p, i) => {
        const existing = visible.find((v) => isSamePerson(p, v));
        if (existing) problems.push(`${p.name} = ${describe(existing)}`);
        const earlier = persons.slice(0, i).find((q) => isSamePerson(p, q));
        if (earlier) problems.push(`${p.name} = ${earlier.name} (twice in this import)`);
      });
      if (problems.length > 0) {
        return fail(`These look like persons already in the tree: ${problems.join('; ')}`, 409);
      }
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
      // Spouse and concubine are stored with the woman as person A, as elsewhere in the app
      if (shouldSwapPartners(r.type, a.gender, b.gender)) [a, b] = [b, a];
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
