/**
 * Chinese Kinship Terminology Module
 *
 * This module provides comprehensive Chinese kinship term calculation
 * based on family graph relationships.
 */

import type { Person, Relationship } from '@/types';
import { RelationshipType, Gender as GenderEnum } from '@/types';
import type { RelationshipPath, KinshipSide } from './types';
import { KinshipRelationshipType } from './types';
import { findRelationshipPath, getGenderKey } from './path-finder';
import { getChineseKinshipTerm } from './terms';
import { EXTENDED_KINSHIP_TERMS } from './constants';
import { householdTerm } from './wives-concubines';
import { bloodTerm } from './blood-terms';
import { siblingSpouseTerm } from './sibling-spouse-terms';
import { descendantSpouseTerm } from './descendant-spouse-terms';
import { chainTerm, type KinshipOptions } from './chain-terms';

export type { KinshipContext, RelationshipPath, RelationshipEdge, PathNode, GenderKey, KinshipSide, GrandparentSide } from './types';
export { KinshipRelationshipType } from './types';
export { findRelationshipPath, getGenderKey } from './path-finder';
export { getChineseKinshipTerm } from './terms';
export { KINSHIP_TERMS, EXTENDED_KINSHIP_TERMS } from './constants';
export type { KinshipOptions, KinshipRegion, KinshipStyle } from './chain-terms';

/**
 * Calculate detailed relationship context for accurate kinship terms
 * This analyzes the family graph to determine paternal/maternal side
 */
export function calculateDetailedRelationship(
  fromPersonId: string,
  toPersonId: string,
  persons: Person[],
  relationships: Relationship[],
  options: KinshipOptions = {}
): {
  term: string;
  path: RelationshipPath | null;
  context: {
    side?: 'PATERNAL' | 'MATERNAL';
    isOlder?: boolean;
    generationDiff: number;
    siblingRank?: { rank: number; total: number };
  };
} {
  const personMap = new Map(persons.map(p => [p.id, p]));
  const fromPerson = personMap.get(fromPersonId);
  const toPerson = personMap.get(toPersonId);

  if (!fromPerson || !toPerson) {
    return {
      term: '未知关系',
      path: null,
      context: { generationDiff: 0 },
    };
  }

  // Wives, concubines and the husband's children by another of them
  const household = householdTerm(fromPersonId, toPersonId, relationships, personMap);
  if (household) {
    return { term: household.term, path: null, context: { generationDiff: household.generations } };
  }
  // The chain of family steps between them, looked up in the table (chain-terms.ts); the rules
  // below name what the table does not cover (longer chains, unknown genders, half siblings)
  const chain = chainTerm(fromPersonId, toPersonId, persons, relationships, personMap, options);
  if (chain) {
    return { term: chain.term, path: null, context: { generationDiff: chain.generations } };
  }
  // The spouse of one's spouse's sibling: 舅嫂, 内弟媳, 连襟, 妯娌, 姐夫, 妹夫
  const siblingSpouse = siblingSpouseTerm(fromPersonId, toPersonId, relationships, personMap);
  if (siblingSpouse) {
    return { term: siblingSpouse.term, path: null, context: { generationDiff: siblingSpouse.generations } };
  }
  // A grandchild's or great-grandchild's spouse: 孙媳, 外孙女婿, 曾孙媳; and 岳祖父 the other way
  const descendantSpouse = descendantSpouseTerm(fromPersonId, toPersonId, relationships, personMap);
  if (descendantSpouse) {
    return { term: descendantSpouse.term, path: null, context: { generationDiff: descendantSpouse.generations } };
  }
  // Nephews and nieces, cousins and their children, parents' cousins: 堂 or 表
  // A marriage that links them more closely is named along that link alone
  const blood = bloodTerm(fromPersonId, toPersonId, relationships, personMap);
  if (blood && 'term' in blood) {
    return { term: blood.term, path: null, context: { generationDiff: blood.generations } };
  }

  const path = findRelationshipPath(fromPersonId, toPersonId, persons, blood?.closer ?? relationships);

  if (!path) {
    return {
      term: '未知关系',
      path: null,
      context: { generationDiff: 0 },
    };
  }

  let side: KinshipSide | undefined;

  if (path.type === 'COLLATERAL' || path.relationshipType === KinshipRelationshipType.AUNT_UNCLE || path.relationshipType === KinshipRelationshipType.COUSIN) {
    side = determineSide(fromPersonId, toPersonId, persons, relationships);
  }

  let isOlder: boolean | undefined;
  let siblingRank: { rank: number; total: number } | undefined;

  if (path.relationshipType === KinshipRelationshipType.AUNT_UNCLE) {
    isOlder = determineAuntUncleAgeOrder(fromPersonId, toPersonId, persons, relationships);
    siblingRank = determineSiblingRank(toPersonId, persons, relationships);
  } else if (path.relationshipType === KinshipRelationshipType.SIBLING) {
    isOlder = determineAgeOrder(fromPerson, toPerson);
    siblingRank = determineSiblingRank(toPersonId, persons, relationships);
  } else {
    isOlder = determineAgeOrder(fromPerson, toPerson);
  }

  const nephew = nephewTerm(fromPersonId, toPersonId, path.relationshipType as KinshipRelationshipType, relationships, personMap);
  const term = nephew ?? getChineseKinshipTerm(fromPerson, toPerson, path, { side, isOlder, siblingRank });

  return {
    term,
    path,
    context: {
      side,
      isOlder,
      generationDiff: path.generations,
      siblingRank,
    },
  };
}

const NEPHEW_DEPTH: Partial<Record<KinshipRelationshipType, number>> = {
  [KinshipRelationshipType.NEPHEW_NIECE]: 1,
  [KinshipRelationshipType.GREAT_NEPHEW_NIECE]: 2,
  [KinshipRelationshipType.GREAT_GREAT_NEPHEW_NIECE]: 3,
};

/**
 * A sibling's (or the spouse's sibling's) child, grandchild or great-grandchild, named by that
 * sibling: a brother's 侄子 / 侄孙 / 侄曾孙, a sister's 外甥 / 外甥孙 / 外甥曾孙, a wife's brother's
 * 内侄 / 内侄孙 (a husband's brother's are 侄 as one's own). Null when the sibling is not found.
 */
function nephewTerm(
  fromId: string,
  toId: string,
  type: KinshipRelationshipType,
  relationships: Relationship[],
  personMap: Map<string, Person>
): string | null {
  const depth = NEPHEW_DEPTH[type];
  if (!depth) return null;
  const parentsOf = (id: string) =>
    relationships
      .filter((r) => r.type === RelationshipType.PARENT_CHILD && r.personBId === id)
      .map((r) => r.personAId);
  const isSibling = (a: string, b: string) =>
    a !== b &&
    (parentsOf(a).some((p) => parentsOf(b).includes(p)) ||
      relationships.some(
        (r) =>
          (r.type === RelationshipType.SIBLING || r.type === RelationshipType.HALF_SIBLING) &&
          ((r.personAId === a && r.personBId === b) || (r.personAId === b && r.personBId === a))
      ));
  const spouses = relationships
    .filter((r) => r.type === RelationshipType.SPOUSE && (r.personAId === fromId || r.personBId === fromId))
    .map((r) => (r.personAId === fromId ? r.personBId : r.personAId));

  // The target's ancestors `depth` generations up
  let line = [toId];
  for (let i = 0; i < depth; i++) line = line.flatMap(parentsOf);
  let sibling = line.find((id) => isSibling(fromId, id));
  let viaWife = false;
  if (!sibling) {
    for (const spouse of spouses) {
      sibling = line.find((id) => isSibling(spouse, id));
      if (sibling) {
        viaWife = personMap.get(spouse)?.gender === GenderEnum.FEMALE;
        break;
      }
    }
  }
  if (!sibling) return null;

  const female = personMap.get(toId)?.gender === GenderEnum.FEMALE;
  const brother = personMap.get(sibling)?.gender === GenderEnum.MALE;
  const level = ['', '', '孙', '曾孙'][depth];
  if (!brother) return `外甥${level}${female ? '女' : ''}`;
  const base = viaWife ? '内侄' : '侄';
  if (depth === 1) return `${base}${female ? '女' : viaWife ? '' : '子'}`;
  return `${base}${level}${female ? '女' : ''}`;
}

/**
 * Determine if a collateral relationship is paternal or maternal
 */
function determineSide(
  fromPersonId: string,
  toPersonId: string,
  persons: Person[],
  relationships: Relationship[]
): KinshipSide | undefined {
  const personMap = new Map(persons.map(p => [p.id, p]));

  // Find parents of fromPerson
  const fromParents = relationships
    .filter(r => r.type === RelationshipType.PARENT_CHILD && r.personBId === fromPersonId)
    .map(r => r.personAId);

  // Find parents of toPerson
  const toParents = relationships
    .filter(r => r.type === RelationshipType.PARENT_CHILD && r.personBId === toPersonId)
    .map(r => r.personAId);

  // Find common parent (for siblings)
  const commonParent = fromParents.find(p => toParents.includes(p));

  if (commonParent) {
    const parent = personMap.get(commonParent);
    if (parent) {
      return parent.gender === GenderEnum.MALE ? 'PATERNAL' : 'MATERNAL';
    }
  }

  // For cousin relationships
  // Check if fromPerson's parent and toPerson's parent are siblings (share a common parent)
  for (const fromParentId of fromParents) {
    // Find parents of fromPerson's parent (grandparents of fromPerson)
    const fromGrandparentIds = relationships
      .filter(r => r.type === RelationshipType.PARENT_CHILD && r.personBId === fromParentId)
      .map(r => r.personAId);

    for (const toParentId of toParents) {
      // Find parents of toPerson's parent (grandparents of toPerson)
      const toGrandparentIds = relationships
        .filter(r => r.type === RelationshipType.PARENT_CHILD && r.personBId === toParentId)
        .map(r => r.personAId);

      // Check if the parents share a common parent (are siblings)
      const sharedGrandparent = fromGrandparentIds.find(gp => toGrandparentIds.includes(gp));

      if (sharedGrandparent) {
        const grandparent = personMap.get(sharedGrandparent);
        if (grandparent) {
          // The side is determined by the shared grandparent's gender
          // Male grandparent = paternal side (堂)
          // Female grandparent = maternal side (表)
          return grandparent.gender === GenderEnum.MALE ? 'PATERNAL' : 'MATERNAL';
        }
      }
    }
  }

  // For aunt/uncle relationships
  // Check if toPerson is a sibling (shares a parent) of fromPerson's parent
  for (const parentId of fromParents) {
    // Find parents of this parent (grandparents of fromPerson)
    const grandparentIds = relationships
      .filter(r => r.type === RelationshipType.PARENT_CHILD && r.personBId === parentId)
      .map(r => r.personAId);

    // Check if toPerson shares a parent with fromPerson's parent (are siblings)
    const toPersonParents = relationships
      .filter(r => r.type === RelationshipType.PARENT_CHILD && r.personBId === toPersonId)
      .map(r => r.personAId);

    const sharedGrandparent = grandparentIds.find(gp => toPersonParents.includes(gp));

    if (sharedGrandparent) {
      const grandparent = personMap.get(sharedGrandparent);
      if (grandparent) {
        // If the shared grandparent is male, it's paternal
        // If the shared grandparent is female, it's maternal
        return grandparent.gender === GenderEnum.MALE ? 'PATERNAL' : 'MATERNAL';
      }
    }
  }

  return undefined;
}

/**
 * Determine relative age order based on birth dates
 */
function determineAgeOrder(
  fromPerson: Person,
  toPerson: Person
): boolean | undefined {
  // Compare birth years
  if (fromPerson.birthYear && toPerson.birthYear) {
    if (fromPerson.birthYear !== toPerson.birthYear) {
      return toPerson.birthYear < fromPerson.birthYear;
    }
    // Same year, compare months
    if (fromPerson.birthMonth && toPerson.birthMonth) {
      if (fromPerson.birthMonth !== toPerson.birthMonth) {
        return toPerson.birthMonth < fromPerson.birthMonth;
      }
      // Same month, compare days
      if (fromPerson.birthDay && toPerson.birthDay) {
        return toPerson.birthDay < fromPerson.birthDay;
      }
    }
  }
  return undefined;
}

/**
 * Determine birth order rank among siblings of the same gender
 * Brothers are ranked separately from sisters
 * Returns 1-based rank (1 = oldest, 2 = second, etc.)
 * Also returns total count of same-gender siblings
 */
export function determineSiblingRank(
  personId: string,
  persons: Person[],
  relationships: Relationship[]
): { rank: number; total: number } | undefined {
  const personMap = new Map(persons.map(p => [p.id, p]));
  const person = personMap.get(personId);
  if (!person) return undefined;

  const parentIds = relationships
    .filter(r => r.type === RelationshipType.PARENT_CHILD && r.personBId === personId)
    .map(r => r.personAId);

  if (parentIds.length === 0) return undefined;

  const siblingIds = new Set<string>();
  siblingIds.add(personId);

  for (const parentId of parentIds) {
    const childrenOfParent = relationships
      .filter(r => r.type === RelationshipType.PARENT_CHILD && r.personAId === parentId)
      .map(r => r.personBId);
    childrenOfParent.forEach(id => siblingIds.add(id));
  }

  const sameGenderSiblingsWithBirthDates: Array<{ id: string; birthDate: number }> = [];

  for (const siblingId of siblingIds) {
    const sibling = personMap.get(siblingId);
    // Only include siblings of the same gender
    if (sibling && sibling.gender === person.gender && sibling.birthYear) {
      const birthValue =
        sibling.birthYear * 10000 +
        (sibling.birthMonth || 7) * 100 +
        (sibling.birthDay || 15);
      sameGenderSiblingsWithBirthDates.push({ id: siblingId, birthDate: birthValue });
    }
  }

  if (sameGenderSiblingsWithBirthDates.length === 0) return undefined;

  sameGenderSiblingsWithBirthDates.sort((a, b) => a.birthDate - b.birthDate);

  const rank = sameGenderSiblingsWithBirthDates.findIndex(s => s.id === personId) + 1;
  const total = sameGenderSiblingsWithBirthDates.length;

  return { rank, total };
}

/**
 * Determine age order for aunt/uncle relationships
 * Compares the aunt/uncle's age with the parent's age (not the child's)
 * Uses derived sibling relationships based on shared parents
 */
function determineAuntUncleAgeOrder(
  fromPersonId: string,
  toPersonId: string,
  persons: Person[],
  relationships: Relationship[]
): boolean | undefined {
  const personMap = new Map(persons.map(p => [p.id, p]));

  // Find the parents of fromPerson
  const fromParents = relationships
    .filter(r => r.type === RelationshipType.PARENT_CHILD && r.personBId === fromPersonId)
    .map(r => r.personAId);

  // Find toPerson's parents
  const toPersonParents = relationships
    .filter(r => r.type === RelationshipType.PARENT_CHILD && r.personBId === toPersonId)
    .map(r => r.personAId);

  // Check if toPerson is a derived sibling (shares a parent) of any of fromPerson's parents
  for (const parentId of fromParents) {
    // Find parents of this parent (grandparents of fromPerson)
    const grandparentIds = relationships
      .filter(r => r.type === RelationshipType.PARENT_CHILD && r.personBId === parentId)
      .map(r => r.personAId);

    // Check if toPerson shares a parent with fromPerson's parent
    const sharedGrandparent = grandparentIds.find(gp => toPersonParents.includes(gp));

    if (sharedGrandparent) {
      const parent = personMap.get(parentId);
      const auntUncle = personMap.get(toPersonId);

      if (parent && auntUncle) {
        // Compare parent's age with aunt/uncle's age
        // Return true if aunt/uncle is older than parent
        return determineAgeOrder(parent, auntUncle);
      }
    }
  }

  return undefined;
}

/**
 * Main function to get Chinese kinship term for any relationship
 */
export function getChineseRelationshipLabel(
  fromPersonId: string,
  toPersonId: string,
  persons: Person[],
  relationships: Relationship[],
  options: KinshipOptions = {}
): string {
  const result = calculateDetailedRelationship(fromPersonId, toPersonId, persons, relationships, options);
  return result.term;
}
