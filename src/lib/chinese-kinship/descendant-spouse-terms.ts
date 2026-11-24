import type { Person, Relationship } from '@/types';
import { Gender, RelationshipType } from '@/types';

/**
 * Terms between a person and the spouse of their grandchild or great-grandchild:
 *
 *   ancestor → spouse     grandson's wife 孙媳, granddaughter's husband 孙女婿; through a daughter
 *                         外孙媳, 外孙女婿; one generation further 曾孙媳, 曾孙女婿, 外曾孙媳, 外曾孙女婿
 *   wife's ancestor       a granddaughter's husband calls her grandparents 岳祖父 / 岳祖母, on her
 *   ← her husband         mother's side 岳外祖父 / 岳外祖母, one generation further 岳曾祖父 / 岳曾祖母
 *
 * 外 follows the line: the ancestor's child on it (ancestor → spouse) or the wife's parent on it
 * (husband → ancestor). A grandson's wife calls his grandparents as he does (祖父 and so on), which
 * the general rules give. Children's spouses (儿媳, 女婿) are left to the general rules too.
 */

const MIN = 2;
const MAX = 3;

/** The term `fromId` uses for `toId` when one is the other's grandchild's or great-grandchild's spouse, or null */
export function descendantSpouseTerm(
  fromId: string,
  toId: string,
  relationships: Relationship[],
  personMap: Map<string, Person>
): { term: string; generations: number } | null {
  const gender = (id: string) => personMap.get(id)?.gender;
  const spousesOf = (id: string) =>
    relationships
      .filter((r) => r.type === RelationshipType.SPOUSE && (r.personAId === id || r.personBId === id))
      .map((r) => (r.personAId === id ? r.personBId : r.personAId));
  const childrenOf = (id: string) =>
    relationships.filter((r) => r.type === RelationshipType.PARENT_CHILD && r.personAId === id).map((r) => r.personBId);

  /** The line from an ancestor down to a descendant MIN to MAX generations below, or null */
  const lineDown = (ancestorId: string, descendantId: string): string[] | null => {
    let paths: string[][] = [[ancestorId]];
    for (let depth = 1; depth <= MAX; depth++) {
      paths = paths.flatMap((path) => childrenOf(path[path.length - 1]).map((child) => [...path, child]));
      const found = paths.find((path) => path[path.length - 1] === descendantId);
      if (found) return depth >= MIN ? found : null;
    }
    return null;
  };

  // The ancestor speaking of their descendant's spouse
  for (const spouseOfTarget of spousesOf(toId)) {
    const line = lineDown(fromId, spouseOfTarget);
    if (!line) continue;
    const generations = line.length - 1;
    const prefix = gender(line[1]) === Gender.FEMALE ? '外' : '';
    const base = generations === 2 ? '孙' : '曾孙';
    const descendantGender = gender(spouseOfTarget);
    const isHusband =
      descendantGender === Gender.FEMALE || (descendantGender !== Gender.MALE && gender(toId) === Gender.MALE);
    return { term: `${prefix}${base}${isHusband ? '女婿' : '媳'}`, generations };
  }

  // A granddaughter's (or great-granddaughter's) husband speaking of her ancestor
  for (const wifeId of spousesOf(fromId)) {
    if (gender(wifeId) !== Gender.FEMALE) continue;
    const line = lineDown(toId, wifeId);
    if (!line) continue;
    const generations = line.length - 1;
    const prefix = gender(line[line.length - 2]) === Gender.FEMALE ? '外' : '';
    const base = generations === 2 ? '祖' : '曾祖';
    const parent = gender(toId) === Gender.FEMALE ? '母' : gender(toId) === Gender.MALE ? '父' : '父母';
    return { term: `岳${prefix}${base}${parent}`, generations };
  }
  return null;
}
