import type { Person, Relationship } from '@/types';
import { Gender, RelationshipType } from '@/types';

/**
 * Terms for the spouse of one's spouse's sibling (and, read the other way, the same relation):
 *
 *   wife's elder brother's wife      舅嫂        wife's younger brother's wife    内弟媳
 *   wife's elder sister's husband    襟兄        wife's younger sister's husband  襟弟
 *   husband's elder brother's wife   嫂子        husband's younger brother's wife 弟妹
 *   husband's elder sister's husband 姐夫        husband's younger sister's husband 妹夫
 *
 * Elder or younger compares the sibling with one's own spouse, by birth year; when that is not
 * known, the term names both (连襟, 妯娌, 舅嫂/内弟媳, 姐夫/妹夫).
 */

export const SIBLING_SPOUSE_TERMS = {
  WIFE_ELDER_BROTHER_WIFE: '舅嫂',
  WIFE_YOUNGER_BROTHER_WIFE: '内弟媳',
  WIFE_BROTHER_WIFE: '舅嫂/内弟媳',
  WIFE_ELDER_SISTER_HUSBAND: '襟兄',
  WIFE_YOUNGER_SISTER_HUSBAND: '襟弟',
  WIFE_SISTER_HUSBAND: '连襟',
  HUSBAND_ELDER_BROTHER_WIFE: '嫂子',
  HUSBAND_YOUNGER_BROTHER_WIFE: '弟妹',
  HUSBAND_BROTHER_WIFE: '妯娌',
  HUSBAND_ELDER_SISTER_HUSBAND: '姐夫',
  HUSBAND_YOUNGER_SISTER_HUSBAND: '妹夫',
  HUSBAND_SISTER_HUSBAND: '姐夫/妹夫',
} as const;

/** The term `fromId` uses for `toId` when `toId` is the spouse of `fromId`'s spouse's sibling, or null */
export function siblingSpouseTerm(
  fromId: string,
  toId: string,
  relationships: Relationship[],
  personMap: Map<string, Person>
): { term: string; generations: number } | null {
  const spousesOf = (id: string) =>
    relationships
      .filter((r) => r.type === RelationshipType.SPOUSE && (r.personAId === id || r.personBId === id))
      .map((r) => (r.personAId === id ? r.personBId : r.personAId));
  const parentsOf = (id: string) =>
    relationships.filter((r) => r.type === RelationshipType.PARENT_CHILD && r.personBId === id).map((r) => r.personAId);
  const areSiblings = (a: string, b: string) => {
    if (a === b) return false;
    const linked = relationships.some(
      (r) =>
        (r.type === RelationshipType.SIBLING || r.type === RelationshipType.HALF_SIBLING) &&
        ((r.personAId === a && r.personBId === b) || (r.personAId === b && r.personBId === a))
    );
    if (linked) return true;
    const parents = new Set(parentsOf(a));
    return parentsOf(b).some((p) => parents.has(p));
  };
  const gender = (id: string) => personMap.get(id)?.gender;

  const toSpouses = new Set(spousesOf(toId));
  for (const spouseId of spousesOf(fromId)) {
    const siblingId = [...toSpouses].find((id) => id !== fromId && areSiblings(spouseId, id));
    if (!siblingId) continue;

    const spouse = personMap.get(spouseId);
    const sibling = personMap.get(siblingId);
    const elder =
      sibling?.birthYear != null && spouse?.birthYear != null && sibling.birthYear !== spouse.birthYear
        ? sibling.birthYear < spouse.birthYear
        : undefined;
    const byAge = (older: string, younger: string, either: string) => (elder === undefined ? either : elder ? older : younger);
    const T = SIBLING_SPOUSE_TERMS;

    // The speaker's spouse's sex tells whose side this is: a wife's or a husband's siblings
    const wifeSide = gender(spouseId) === Gender.FEMALE || (gender(spouseId) !== Gender.MALE && gender(fromId) === Gender.MALE);
    const brother = gender(siblingId) === Gender.MALE;
    const sister = gender(siblingId) === Gender.FEMALE;
    if (!brother && !sister) return null;

    const term = wifeSide
      ? brother
        ? byAge(T.WIFE_ELDER_BROTHER_WIFE, T.WIFE_YOUNGER_BROTHER_WIFE, T.WIFE_BROTHER_WIFE)
        : byAge(T.WIFE_ELDER_SISTER_HUSBAND, T.WIFE_YOUNGER_SISTER_HUSBAND, T.WIFE_SISTER_HUSBAND)
      : brother
        ? byAge(T.HUSBAND_ELDER_BROTHER_WIFE, T.HUSBAND_YOUNGER_BROTHER_WIFE, T.HUSBAND_BROTHER_WIFE)
        : byAge(T.HUSBAND_ELDER_SISTER_HUSBAND, T.HUSBAND_YOUNGER_SISTER_HUSBAND, T.HUSBAND_SISTER_HUSBAND);
    return { term, generations: 0 };
  }
  return null;
}
