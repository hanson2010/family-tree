import type { Person } from '@/types';

export const SITE_NAME = '家谱';

/** A person's name with their years: 林黛玉（1719–） */
export function personHeading(person: Pick<Person, 'name' | 'birthYear' | 'deathYear'>): string {
  const years =
    person.birthYear || person.deathYear ? `（${person.birthYear ?? '?'}–${person.deathYear ?? ''}）` : '';
  return `${person.name}${years}`;
}

/** The page title for the tree centred on a person, or the site's own without one */
export function personTitle(person: Pick<Person, 'name' | 'birthYear' | 'deathYear'> | null): string {
  return person ? `${personHeading(person)} · ${SITE_NAME}` : SITE_NAME;
}
