import type { Person, Relationship } from '@/types';
import { compareUnionStart } from '@/lib/marriage-order';
import { Gender, RelationshipType } from '@/types';

/**
 * Terms within one man's household of wives (妻) and concubines (妾):
 * - between the women: a concubine calls the wife 主母 and the wife calls her 侧室; concubines
 *   call each other 姐姐 / 妹妹 by who joined first; of two wives, the earlier is 原配 and the
 *   later 继室;
 * - between the women and his children by another of them: a concubine's child calls the wife
 *   嫡母 and calls a concubine 庶母; the wife calls a concubine's child 庶子 / 庶女, and a
 *   concubine calls the wife's child 嫡子 / 嫡女 and another concubine's child 庶子 / 庶女.
 * Two wives and their children (继母 and so on) are left to the general rules.
 */

export const HOUSEHOLD_TERMS = {
  PRINCIPAL_WIFE: '主母',
  CONCUBINE: '侧室',
  FIRST_WIFE: '原配',
  LATER_WIFE: '继室',
  WIFE: '妻室',
  SISTER_OLDER: '姐姐',
  SISTER_YOUNGER: '妹妹',
  SISTERS: '姐妹',
  LEGAL_MOTHER: '嫡母',
  CONCUBINE_MOTHER: '庶母',
  LEGAL_SON: '嫡子',
  LEGAL_DAUGHTER: '嫡女',
  CONCUBINE_SON: '庶子',
  CONCUBINE_DAUGHTER: '庶女',
  CONCUBINE_CHILD: '庶出子女',
  LEGAL_CHILD: '嫡出子女',
} as const;

type Union = RelationshipType.SPOUSE | RelationshipType.CONCUBINE;

/** The household term `fromId` uses for `toId`, with their generation distance, or null when none applies */
export function householdTerm(
  fromId: string,
  toId: string,
  relationships: Relationship[],
  personMap: Map<string, Person>
): { term: string; generations: number } | null {
  /** Each partner of a person, as wife or concubine, with the relationship */
  const unions = (id: string) => {
    const result = new Map<string, Relationship & { type: Union }>();
    relationships.forEach((r) => {
      if (r.type !== RelationshipType.SPOUSE && r.type !== RelationshipType.CONCUBINE) return;
      if (r.personAId === id) result.set(r.personBId, r as Relationship & { type: Union });
      else if (r.personBId === id) result.set(r.personAId, r as Relationship & { type: Union });
    });
    return result;
  };
  const parentsOf = (id: string) =>
    relationships.filter((r) => r.type === RelationshipType.PARENT_CHILD && r.personBId === id).map((r) => r.personAId);
  const isWoman = (id: string) => personMap.get(id)?.gender !== Gender.MALE;
  const isMan = (id: string) => personMap.get(id)?.gender === Gender.MALE;

  // Two women of the same man
  if (isWoman(fromId) && isWoman(toId)) {
    for (const [husbandId, fromUnion] of unions(fromId)) {
      if (!isMan(husbandId)) continue;
      const toUnion = unions(husbandId).get(toId);
      if (!toUnion) continue;
      if (fromUnion.type === RelationshipType.CONCUBINE && toUnion.type === RelationshipType.SPOUSE) {
        return { term: HOUSEHOLD_TERMS.PRINCIPAL_WIFE, generations: 0 };
      }
      if (fromUnion.type === RelationshipType.SPOUSE && toUnion.type === RelationshipType.CONCUBINE) {
        return { term: HOUSEHOLD_TERMS.CONCUBINE, generations: 0 };
      }
      const toFirst = joinedFirst(toUnion, fromUnion, personMap.get(toId), personMap.get(fromId));
      if (fromUnion.type === RelationshipType.CONCUBINE) {
        const term =
          toFirst === undefined ? HOUSEHOLD_TERMS.SISTERS : toFirst ? HOUSEHOLD_TERMS.SISTER_OLDER : HOUSEHOLD_TERMS.SISTER_YOUNGER;
        return { term, generations: 0 };
      }
      const term = toFirst === undefined ? HOUSEHOLD_TERMS.WIFE : toFirst ? HOUSEHOLD_TERMS.FIRST_WIFE : HOUSEHOLD_TERMS.LATER_WIFE;
      return { term, generations: 0 };
    }
  }

  // A man's child and another woman of his: `childId` is the child, `womanId` the woman
  const childAndWoman = (childId: string, womanId: string) => {
    const parents = parentsOf(childId);
    if (parents.includes(womanId) || !isWoman(womanId)) return null;
    for (const fatherId of parents) {
      if (!isMan(fatherId)) continue;
      const fatherUnions = unions(fatherId);
      const womanUnion = fatherUnions.get(womanId);
      if (!womanUnion) continue;
      const motherId = parents.find((id) => id !== fatherId && fatherUnions.has(id));
      return { woman: womanUnion.type, mother: motherId ? fatherUnions.get(motherId)!.type : undefined };
    }
    return null;
  };

  // The child speaking
  const asChild = childAndWoman(fromId, toId);
  if (asChild) {
    if (asChild.woman === RelationshipType.CONCUBINE) return { term: HOUSEHOLD_TERMS.CONCUBINE_MOTHER, generations: 1 };
    if (asChild.mother === RelationshipType.CONCUBINE) return { term: HOUSEHOLD_TERMS.LEGAL_MOTHER, generations: 1 };
    return null;
  }

  // The woman speaking
  const asWoman = childAndWoman(toId, fromId);
  if (asWoman) {
    const childGender = personMap.get(toId)?.gender;
    const concubineChild =
      childGender === Gender.MALE
        ? HOUSEHOLD_TERMS.CONCUBINE_SON
        : childGender === Gender.FEMALE
          ? HOUSEHOLD_TERMS.CONCUBINE_DAUGHTER
          : HOUSEHOLD_TERMS.CONCUBINE_CHILD;
    if (asWoman.mother === RelationshipType.CONCUBINE) return { term: concubineChild, generations: 1 };
    if (asWoman.woman === RelationshipType.CONCUBINE && asWoman.mother === RelationshipType.SPOUSE) {
      const term =
        childGender === Gender.MALE
          ? HOUSEHOLD_TERMS.LEGAL_SON
          : childGender === Gender.FEMALE
            ? HOUSEHOLD_TERMS.LEGAL_DAUGHTER
            : HOUSEHOLD_TERMS.LEGAL_CHILD;
      return { term, generations: 1 };
    }
  }
  return null;
}

/**
 * Whether the woman of union `a` joined the household before the woman of union `b`: by the
 * start year of each union, else by birth year; undefined when neither tells.
 */
export function joinedFirst(
  a: Relationship,
  b: Relationship,
  personA?: Pick<Person, 'birthYear'>,
  personB?: Pick<Person, 'birthYear'>
): boolean | undefined {
  const order = compareUnionStart(a, b, personA, personB);
  return order === 0 ? undefined : order < 0;
}
