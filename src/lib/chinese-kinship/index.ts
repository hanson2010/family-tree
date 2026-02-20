/**
 * Chinese Kinship Terminology Module
 *
 * This module provides comprehensive Chinese kinship term calculation
 * based on family graph relationships.
 */

import type { Person, Relationship } from '@/types';
import { RelationshipType, Gender as GenderEnum } from '@/types';
import type { RelationshipPath } from './types';
import { findRelationshipPath, getGenderKey } from './path-finder';
import { getChineseKinshipTerm } from './terms';
import { EXTENDED_KINSHIP_TERMS } from './constants';

// Re-export types
export type { KinshipContext, RelationshipPath, RelationshipEdge, PathNode, GenderKey } from './types';

// Re-export functions
export { findRelationshipPath, getGenderKey } from './path-finder';
export { getChineseKinshipTerm } from './terms';
export { EXTENDED_KINSHIP_TERMS } from './constants';

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

  // Determine paternal vs maternal side for collateral relationships
  let side: 'PATERNAL' | 'MATERNAL' | undefined;

  if (path.type === 'COLLATERAL' || path.relationshipType === 'AUNT_UNCLE' || path.relationshipType === 'COUSIN') {
    // Find the common ancestor to determine side
    side = determineSide(fromPersonId, toPersonId, persons, relationships);
  }

  // Determine age order based on birth dates
  // For aunt/uncle relationships, compare with the parent's age, not the child's
  let isOlder: boolean | undefined;
  if (path.relationshipType === 'AUNT_UNCLE') {
    isOlder = determineAuntUncleAgeOrder(fromPersonId, toPersonId, persons, relationships);
  } else {
    isOlder = determineAgeOrder(fromPerson, toPerson);
  }

  const term = getChineseKinshipTerm(fromPerson, toPerson, path, { side, isOlder });

  return {
    term,
    path,
    context: {
      side,
      isOlder,
      generationDiff: path.generations,
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
): 'PATERNAL' | 'MATERNAL' | undefined {
  const personMap = new Map(persons.map(p => [p.id, p]));

  // Find parents of fromPerson
  const fromParents = relationships
    .filter(r => r.type === RelationshipType.PARENT_CHILD && r.personBId === fromPersonId)
    .map(r => r.personAId);

  // Find parents of toPerson
  const toParents = relationships
    .filter(r => r.type === RelationshipType.PARENT_CHILD && r.personBId === toPersonId)
    .map(r => r.personAId);

  // Find common parent (for siblings/cousins)
  const commonParent = fromParents.find(p => toParents.includes(p));

  if (commonParent) {
    const parent = personMap.get(commonParent);
    if (parent) {
      return parent.gender === GenderEnum.MALE ? 'PATERNAL' : 'MATERNAL';
    }
  }

  // For aunt/uncle relationships
  // Check if toPerson is a derived sibling (shares a parent) of fromPerson's parent
  for (const parentId of fromParents) {
    // Find parents of this parent (grandparents of fromPerson)
    const grandparentIds = relationships
      .filter(r => r.type === RelationshipType.PARENT_CHILD && r.personBId === parentId)
      .map(r => r.personAId);

    // Find toPerson's parents
    const toPersonParents = relationships
      .filter(r => r.type === RelationshipType.PARENT_CHILD && r.personBId === toPersonId)
      .map(r => r.personAId);

    // Check if toPerson shares a parent with fromPerson's parent (derived sibling)
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
