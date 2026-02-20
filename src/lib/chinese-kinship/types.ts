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

export interface KinshipContext {
  fromPerson: Person;
  toPerson: Person;
  relationships: Relationship[];
  allPersons: Person[];
}

export interface RelationshipPath {
  type: 'DIRECT' | 'COLLATERAL';
  generations: number;
  side?: 'PATERNAL' | 'MATERNAL';
  isOlder?: boolean;
  relationshipType: string;
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
