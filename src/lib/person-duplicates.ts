import { KINDS, queryEntities } from '@/lib/firestore';
import { isSamePerson, type Identity } from '@/lib/person-identity';
import type { Person } from '@/types';

/**
 * The existing person that `person` duplicates, among those `userId` can see: public persons and
 * the user's own. Persons with ids in `excludeIds` (the one being edited or merged) do not count.
 * Another user's private person does not count: the user cannot see it.
 */
export async function findVisibleDuplicate(
  person: Identity,
  userId: string,
  excludeIds: string[] = []
): Promise<Person | null> {
  const persons = await queryEntities<Person>(KINDS.PERSON);
  return (
    persons.find(
      (p) => !excludeIds.includes(p.id) && (!p.isPrivate || p.createdBy === userId) && isSamePerson(person, p)
    ) ?? null
  );
}

/** "贾政 (1690)" or "王氏" for messages */
export function describe(p: Pick<Person, 'name' | 'birthYear'>): string {
  return p.birthYear != null ? `${p.name} (${p.birthYear})` : p.name;
}
