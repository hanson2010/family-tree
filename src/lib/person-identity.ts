import type { Person } from '@/types';

/** What identifies a person well enough to tell whether two records are the same person */
export type Identity = Pick<Person, 'name' | 'courtesyName' | 'artName' | 'birthYear' | 'birthMonth' | 'birthDay'>;

const clean = (s?: string | null) => s?.trim() || null;

/**
 * Names a person goes by: name, 字 and 号, alone and after the surname (蒋 + 介石 = 蒋介石). The
 * surname is the first character, or the first two in a name of four or more characters.
 */
export function aliases(p: Pick<Identity, 'name' | 'courtesyName' | 'artName'>): string[] {
  const full = clean(p.name);
  const others = [clean(p.courtesyName), clean(p.artName)].filter((s): s is string => !!s);
  const surnames = full ? [full.slice(0, 1), ...(full.length >= 4 ? [full.slice(0, 2)] : [])] : [];
  return [full, ...others, ...surnames.flatMap((s) => others.map((o) => s + o))].filter((s): s is string => !!s);
}

/** True when one person's name is a name the other goes by */
export function namesMatch(a: Identity, b: Identity): boolean {
  const nameA = clean(a.name);
  const nameB = clean(b.name);
  return (!!nameA && aliases(b).includes(nameA)) || (!!nameB && aliases(a).includes(nameB));
}

/** A name that is only a surname and 氏 (王氏, 欧阳氏), as genealogies record many married women */
export function isClanName(name: string): boolean {
  return /^\p{Script=Han}{1,2}氏$/u.test(name.trim());
}

/**
 * Birth dates that do not tell two records apart: known parts are equal, and a missing year is
 * allowed, except for surname-and-氏 names, which need the same known year.
 */
export function birthsCompatible(a: Identity, b: Identity): boolean {
  if (a.birthYear == null || b.birthYear == null) {
    return !isClanName(a.name) && !isClanName(b.name);
  }
  const agree = (x?: number | null, y?: number | null) => x == null || y == null || x === y;
  return a.birthYear === b.birthYear && agree(a.birthMonth, b.birthMonth) && agree(a.birthDay, b.birthDay);
}

/** Whether two records most likely describe the same person */
export function isSamePerson(a: Identity, b: Identity): boolean {
  return namesMatch(a, b) && birthsCompatible(a, b);
}
