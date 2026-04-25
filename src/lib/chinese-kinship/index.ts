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

export type { KinshipContext, RelationshipPath, RelationshipEdge, PathNode, GenderKey, KinshipSide, GrandparentSide } from './types';
export { KinshipRelationshipType } from './types';
export { findRelationshipPath, getGenderKey } from './path-finder';
export { getChineseKinshipTerm } from './terms';
export { KINSHIP_TERMS, EXTENDED_KINSHIP_TERMS } from './constants';

/**
 * Calculate detailed relationship context for accurate kinship terms
 * This analyzes the family graph to determine paternal/maternal side
 */
export function calculateDetailedRelationship(
  fromPersonId: string,
  toPersonId: string,
  persons: Person[],
  relationships: Relationship[]
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

  const path = findRelationshipPath(fromPersonId, toPersonId, persons, relationships);

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

  const term = getChineseKinshipTerm(fromPerson, toPerson, path, { side, isOlder, siblingRank });

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
  relationships: Relationship[]
): string {
  const result = calculateDetailedRelationship(fromPersonId, toPersonId, persons, relationships);
  return result.term;
}
