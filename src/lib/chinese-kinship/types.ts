import type { Person, Relationship, Gender } from '@/types';

/**
 * Chinese Kinship Terminology Calculator
 *
 * Computes proper Chinese kinship terms based on family graph context.
 * Chinese kinship terms are highly specific and depend on:
 * - Gender of both parties
 * - Generation difference
 * - Paternal vs maternal side
 * - Age order (older/younger sibling)
 * - Direct vs collateral lineage
 */

/**
 * Kinship relationship types computed from family graph traversal
 * These represent the semantic relationship for term lookup
 */
export enum KinshipRelationshipType {
  PARENT = 'PARENT',
  CHILD = 'CHILD',
  SIBLING = 'SIBLING',
  HALF_SIBLING = 'HALF_SIBLING',
  SPOUSE = 'SPOUSE',
  CONCUBINE = 'CONCUBINE',
  BETROTHED = 'BETROTHED',
  ADOPTIVE_PARENT = 'ADOPTIVE_PARENT',
  ADOPTED_CHILD = 'ADOPTED_CHILD',
  FOSTER_PARENT = 'FOSTER_PARENT',
  FOSTER_CHILD = 'FOSTER_CHILD',
  STEPPARENT = 'STEPPARENT',
  STEPCHILD = 'STEPCHILD',
  SWORN_SIBLING = 'SWORN_SIBLING',
  GRANDPARENT = 'GRANDPARENT',
  GRANDCHILD = 'GRANDCHILD',
  GREAT_GRANDPARENT = 'GREAT_GRANDPARENT',
  GREAT_GRANDCHILD = 'GREAT_GRANDCHILD',
  GREAT_GREAT_GRANDPARENT = 'GREAT_GREAT_GRANDPARENT',
  GREAT_GREAT_GRANDCHILD = 'GREAT_GREAT_GRANDCHILD',
  AUNT_UNCLE = 'AUNT_UNCLE',
  AUNT_UNCLE_SPOUSE = 'AUNT_UNCLE_SPOUSE',
  GREAT_AUNT_UNCLE = 'GREAT_AUNT_UNCLE',
  GREAT_GREAT_AUNT_UNCLE = 'GREAT_GREAT_AUNT_UNCLE',
  NEPHEW_NIECE = 'NEPHEW_NIECE',
  GREAT_NEPHEW_NIECE = 'GREAT_NEPHEW_NIECE',
  GREAT_GREAT_NEPHEW_NIECE = 'GREAT_GREAT_NEPHEW_NIECE',
  COUSIN = 'COUSIN',
  PARENT_IN_LAW = 'PARENT_IN_LAW',
  CHILD_IN_LAW = 'CHILD_IN_LAW',
  SIBLING_IN_LAW = 'SIBLING_IN_LAW',
  SPOUSE_SIBLING = 'SPOUSE_SIBLING',
  SIBLINGS_SPOUSE_MUTUAL = 'SIBLINGS_SPOUSE_MUTUAL',
  SISTER_IN_LAW_SPOUSE = 'SISTER_IN_LAW_SPOUSE',
  BROTHERS_WIFE = 'BROTHERS_WIFE',
  BROTERS_HUSBAND = 'BROTHERS_HUSBAND',
  SISTERS_HUSBAND = 'SISTERS_HUSBAND',
  UNKNOWN = 'UNKNOWN',
}

export type KinshipSide = 'PATERNAL' | 'MATERNAL';

export type GrandparentSide = 'PATERNAL_GRANDFATHER' | 'PATERNAL_GRANDMOTHER' | 'MATERNAL_GRANDFATHER' | 'MATERNAL_GRANDMOTHER';

export interface KinshipContext {
  fromPerson: Person;
  toPerson: Person;
  relationships: Relationship[];
  allPersons: Person[];
}

export interface RelationshipPath {
  type: 'DIRECT' | 'COLLATERAL';
  generations: number;
  side?: KinshipSide;
  grandparentSide?: GrandparentSide;
  isOlder?: boolean;
  relationshipType: KinshipRelationshipType | string;
}

/**
 * Edge type for relationship path traversal
 */
export interface RelationshipEdge {
  personId: string;
  relationship: Relationship;
  isPersonA: boolean;
}

/**
 * Path node for BFS traversal
 */
export interface PathNode {
  personId: string;
  path: RelationshipEdge[];
}

export type GenderKey = 'MALE' | 'FEMALE' | 'UNKNOWN';
