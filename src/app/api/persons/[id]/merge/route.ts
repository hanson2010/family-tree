import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { KINDS, getEntity, getFirestore, queryEntitiesByProperty } from '@/lib/firestore';
import { planMerge } from '@/lib/merge';
import { describe, findVisibleDuplicate } from '@/lib/person-duplicates';
import type { ApiResponse, Gender, Person, Relationship } from '@/types';
import { ORDERED_MARRIAGE_TYPES, shouldSwapPartners } from '@/lib/relationship-direction';
import { personSchema } from '@/types';

const fail = (error: string, status: number) => NextResponse.json<ApiResponse<never>>({ success: false, error }, { status });

const mergeSchema = z.object({
  /** The person merged into this one and then deleted */
  otherId: z.string().min(1),
  /** The merged person's details, as chosen field by field */
  person: personSchema.omit({ avatar: true }),
  /** Whose avatar to keep */
  avatarFrom: z.enum(['this', 'other', 'none']),
});

const relationshipsOf = async (id: string) => [
  ...(await queryEntitiesByProperty<Relationship>(KINDS.RELATIONSHIP, 'personAId', id)),
  ...(await queryEntitiesByProperty<Relationship>(KINDS.RELATIONSHIP, 'personBId', id)),
];

// POST /api/persons/[id]/merge - Merge another person into this one, in one batch
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return fail('Unauthorized', 401);

    const { id } = await params;
    const parsed = mergeSchema.safeParse(await request.json());
    if (!parsed.success) return fail(parsed.error.message, 400);
    const { otherId, person: fields, avatarFrom } = parsed.data;
    if (otherId === id) return fail('Choose a different person.', 400);

    // Merging deletes the other person, so both must be the user's own
    const [kept, other] = await Promise.all([getEntity<Person>(KINDS.PERSON, id), getEntity<Person>(KINDS.PERSON, otherId)]);
    if (!kept || !other) return fail('Person not found', 404);
    if (kept.createdBy !== userId || other.createdBy !== userId) return fail('Forbidden', 403);

    // The merged person, if public, must not duplicate a third person
    const duplicate = fields.isPrivate ? null : await findVisibleDuplicate(fields, userId, [id, otherId]);
    if (duplicate) {
      return fail(`Already in the tree: ${describe(duplicate)}. This looks like the same person.`, 409);
    }

    const all = [...(await relationshipsOf(id)), ...(await relationshipsOf(otherId))];
    const unique = all.filter((r, i) => all.findIndex((x) => x.id === r.id) === i);
    const { moved, dropped } = planMerge(id, otherId, unique);

    const now = new Date();
    const merged: Person = {
      ...kept,
      name: fields.name,
      courtesyName: fields.courtesyName,
      artName: fields.artName,
      gender: fields.gender,
      birthYear: fields.birthYear ?? null,
      birthMonth: fields.birthMonth ?? null,
      birthDay: fields.birthDay ?? null,
      deathYear: fields.deathYear ?? null,
      deathMonth: fields.deathMonth ?? null,
      deathDay: fields.deathDay ?? null,
      avatar: avatarFrom === 'this' ? kept.avatar ?? null : avatarFrom === 'other' ? other.avatar ?? null : null,
      isPrivate: fields.isPrivate,
      updatedAt: now,
    };

    // The kept person's marriages, moved or their own, keep the woman as person A, using the
    // merged gender and each partner's gender
    const droppedIds = new Set(dropped);
    const movedIds = new Set(moved.map((r) => r.id));
    const keptOwn = unique.filter(
      (r) => !droppedIds.has(r.id) && !movedIds.has(r.id) && (r.personAId === id || r.personBId === id)
    );
    const genderOf = new Map<string, Gender | undefined>([[id, merged.gender]]);
    const reordered = new Map<string, Relationship>();
    for (const r of [...moved, ...keptOwn]) {
      if (!ORDERED_MARRIAGE_TYPES.includes(r.type)) continue;
      const partner = r.personAId === id ? r.personBId : r.personAId;
      if (!genderOf.has(partner)) genderOf.set(partner, (await getEntity<Person>(KINDS.PERSON, partner))?.gender);
      if (shouldSwapPartners(r.type, genderOf.get(r.personAId), genderOf.get(r.personBId))) {
        reordered.set(r.id, { ...r, personAId: r.personBId, personBId: r.personAId });
      }
    }
    const updates = [...moved.map((r) => reordered.get(r.id) ?? r), ...keptOwn.filter((r) => reordered.has(r.id)).map((r) => reordered.get(r.id)!)];

    const db = getFirestore();
    const batch = db.batch();
    const { id: _keptId, ...keptData } = merged;
    batch.set(db.collection(KINDS.PERSON).doc(id), keptData);
    updates.forEach((r) =>
      batch.update(db.collection(KINDS.RELATIONSHIP).doc(r.id), { personAId: r.personAId, personBId: r.personBId, updatedAt: now })
    );
    dropped.forEach((relId) => batch.delete(db.collection(KINDS.RELATIONSHIP).doc(relId)));
    // Fails the whole batch if the other person was changed or deleted meanwhile
    batch.delete(db.collection(KINDS.PERSON).doc(otherId), { exists: true });
    await batch.commit();

    return NextResponse.json<ApiResponse<Person>>({ success: true, data: merged });
  } catch (error) {
    console.error('Error merging persons:', error);
    return fail('Failed to merge persons', 500);
  }
}
