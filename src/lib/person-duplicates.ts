import { KINDS, queryEntitiesByProperty } from '@/lib/firestore';
import type { Person } from '@/types';

/**
 * An existing person with the same name and birth date that `userId` can see. Another user's
 * private person does not count: the user cannot see it, so they may create their own.
 */
export async function findVisibleDuplicate(
  person: Pick<Person, 'name' | 'birthYear' | 'birthMonth' | 'birthDay'>,
  userId: string
): Promise<Person | null> {
  const sameName = await queryEntitiesByProperty<Person>(KINDS.PERSON, 'name', person.name);
  return (
    sameName.find(
      (p) =>
        (p.birthYear ?? null) === (person.birthYear ?? null) &&
        (p.birthMonth ?? null) === (person.birthMonth ?? null) &&
        (p.birthDay ?? null) === (person.birthDay ?? null) &&
        (!p.isPrivate || p.createdBy === userId)
    ) ?? null
  );
}
