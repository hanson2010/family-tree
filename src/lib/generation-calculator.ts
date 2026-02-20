import type { Person, Relationship, RelationshipType } from '@/types';
import { RelationshipType as RelType } from '@/types';
import { getChineseKinshipTerm, findRelationshipPath, type RelationshipPath } from './chinese-kinship';

/**
 * Generation Calculator
 *
 * Computes generation numbers relative to a selected "center person".
 * This allows flexible visualization of any family tree structure.
 */
export class GenerationCalculator {
  private persons: Map<string, Person>;
  private relationships: Relationship[];

  constructor(persons: Person[], relationships: Relationship[]) {
    this.persons = new Map(persons.map(p => [p.id, p]));
    this.relationships = relationships;
  }

  /**
   * Calculate relative generations for all persons
   * relative to the center person (generation 0)
   */
  calculateRelativeGenerations(centerPersonId: string): Map<string, number> {
    const generations = new Map<string, number>();
    const visited = new Set<string>();
    const queue: Array<{ personId: string; generation: number }> = [
      { personId: centerPersonId, generation: 0 }
    ];

    while (queue.length > 0) {
      const { personId, generation } = queue.shift()!;

      if (visited.has(personId)) continue;
      visited.add(personId);

      generations.set(personId, generation);

      // Get all relationships for this person
      const personRelationships = this.getRelationshipsForPerson(personId);

      for (const rel of personRelationships) {
        const otherId = rel.personAId === personId ? rel.personBId : rel.personAId;

        if (visited.has(otherId)) continue;

        const nextGen = this.calculateNextGeneration(rel, personId, generation);
        queue.push({ personId: otherId, generation: nextGen });
      }
    }

    return generations;
  }

  /**
   * Get all relationships involving a person
   */
  private getRelationshipsForPerson(personId: string): Relationship[] {
    return this.relationships.filter(
      rel => rel.personAId === personId || rel.personBId === personId
    );
  }

  /**
   * Calculate the generation for the other person in a relationship
   */
  private calculateNextGeneration(
    relationship: Relationship,
    currentPersonId: string,
    currentGeneration: number
  ): number {
    const isPersonA = relationship.personAId === currentPersonId;

    switch (relationship.type) {
      case RelType.PARENT_CHILD:
        // If current person is personA, they are the parent
        // If current person is personB, they are the child
        return isPersonA ? currentGeneration + 1 : currentGeneration - 1;

      case RelType.ADOPTIVE_PARENT:
      case RelType.FOSTER_PARENT:
        // Same logic as parent-child
        return isPersonA ? currentGeneration + 1 : currentGeneration - 1;

      case RelType.SIBLING:
      case RelType.HALF_SIBLING:
      case RelType.SWORN_SIBLING:
        // Siblings are in the same generation
        return currentGeneration;

      case RelType.SPOUSE:
      case RelType.CONCUBINE:
      case RelType.BETROTHED:
        // Spouses are in the same generation
        return currentGeneration;

      default:
        return currentGeneration;
    }
  }

  /**
   * Get persons within the visible generation range
   */
  getVisiblePersons(
    centerPersonId: string,
    ancestors: number = 2,
    descendants: number = 3
  ): Person[] {
    const generations = this.calculateRelativeGenerations(centerPersonId);
    const visiblePersons: Person[] = [];

    for (const [personId, gen] of generations) {
      if (gen >= -ancestors && gen <= descendants) {
        const person = this.persons.get(personId);
        if (person) {
          visiblePersons.push({
            ...person,
            relativeGeneration: gen,
          });
        }
      }
    }

    return visiblePersons;
  }

  /**
   * Get relationships between visible persons only
   */
  getVisibleRelationships(visiblePersonIds: Set<string>): Relationship[] {
    return this.relationships.filter(
      rel => visiblePersonIds.has(rel.personAId) && visiblePersonIds.has(rel.personBId)
    );
  }

  /**
   * Get the display order for a person based on generation and gender
   */
  static getDisplayOrder(gender: string, generation: number): number {
    // Males first, then by generation (older generations first)
    const genderOrder = gender === '男' ? 0 : gender === '女' ? 1 : 2;
    return generation * 10 + genderOrder;
  }
}

/**
 * Helper function to get relationship direction
 */
export function getRelationshipDirection(
  relationship: Relationship,
  personId: string
): { direction: 'parent' | 'child' | 'spouse' | 'sibling'; otherPersonId: string } {
  const isPersonA = relationship.personAId === personId;
  const otherPersonId = isPersonA ? relationship.personBId : relationship.personAId;

  switch (relationship.type) {
    case RelType.PARENT_CHILD:
    case RelType.ADOPTIVE_PARENT:
    case RelType.FOSTER_PARENT:
      return {
        direction: isPersonA ? 'child' : 'parent',
        otherPersonId,
      };
    case RelType.SPOUSE:
    case RelType.CONCUBINE:
    case RelType.BETROTHED:
      return {
        direction: 'spouse',
        otherPersonId,
      };
    case RelType.SIBLING:
    case RelType.HALF_SIBLING:
    case RelType.SWORN_SIBLING:
      return {
        direction: 'sibling',
        otherPersonId,
      };
    default:
      return {
        direction: 'sibling',
        otherPersonId,
      };
  }
}

/**
 * Get relationship label for display (Simplified Chinese)
 *
 * For basic usage with just relationship type and gender.
 * For more accurate Chinese kinship terms, use getDetailedRelationshipLabel instead.
 */
export function getRelationshipLabel(
  type: RelationshipType,
  fromGender: string,
  toGender: string
): string {
  // Map string gender to normalized values
  const normalizeGender = (g: string): 'MALE' | 'FEMALE' | 'UNKNOWN' => {
    if (g === 'MALE' || g === '男') return 'MALE';
    if (g === 'FEMALE' || g === '女') return 'FEMALE';
    return 'UNKNOWN';
  };

  const from = normalizeGender(fromGender);
  const to = normalizeGender(toGender);

  // Chinese kinship terms using enum keys
  const labels: Record<RelationshipType, Record<string, string>> = {
    [RelType.PARENT_CHILD]: {
      'MALE-MALE': '儿子',
      'MALE-FEMALE': '女儿',
      'FEMALE-MALE': '儿子',
      'FEMALE-FEMALE': '女儿',
    },
    [RelType.SIBLING]: {
      'MALE-MALE': '兄弟',
      'MALE-FEMALE': '姐妹',
      'FEMALE-MALE': '兄弟',
      'FEMALE-FEMALE': '姐妹',
    },
    [RelType.HALF_SIBLING]: {
      'MALE-MALE': '同父异母兄弟',
      'MALE-FEMALE': '同父异母姐妹',
      'FEMALE-MALE': '同母异父兄弟',
      'FEMALE-FEMALE': '同母异父姐妹',
    },
    [RelType.SPOUSE]: {
      'MALE-FEMALE': '妻子',
      'FEMALE-MALE': '丈夫',
    },
    [RelType.CONCUBINE]: {
      'MALE-FEMALE': '妾',
      'FEMALE-MALE': '夫君',
    },
    [RelType.BETROTHED]: {
      'MALE-FEMALE': '未婚妻',
      'FEMALE-MALE': '未婚夫',
    },
    [RelType.ADOPTIVE_PARENT]: {
      'MALE-MALE': '养子',
      'MALE-FEMALE': '养女',
      'FEMALE-MALE': '养子',
      'FEMALE-FEMALE': '养女',
    },
    [RelType.FOSTER_PARENT]: {
      'MALE-MALE': '义子',
      'MALE-FEMALE': '义女',
      'FEMALE-MALE': '义子',
      'FEMALE-FEMALE': '义女',
    },
    [RelType.SWORN_SIBLING]: {
      'MALE-MALE': '结拜兄弟',
      'MALE-FEMALE': '结拜姐妹',
      'FEMALE-MALE': '结拜兄弟',
      'FEMALE-FEMALE': '结拜姐妹',
    },
  };

  const key = `${from}-${to}`;
  return labels[type]?.[key] || type;
}

/**
 * Get detailed relationship label using full family graph context
 *
 * This function provides accurate Chinese kinship terms by analyzing
 * the family graph to determine:
 * - Paternal vs maternal side
 * - Age order (older/younger)
 * - Generation difference
 * - Direct vs collateral lineage
 */
export function getDetailedRelationshipLabel(
  fromPersonId: string,
  toPersonId: string,
  persons: Person[],
  relationships: Relationship[]
): string {
  const personMap = new Map(persons.map(p => [p.id, p]));
  const fromPerson = personMap.get(fromPersonId);
  const toPerson = personMap.get(toPersonId);

  if (!fromPerson || !toPerson) {
    return '未知关系';
  }

  const path = findRelationshipPath(fromPersonId, toPersonId, persons, relationships);

  if (!path) {
    return '未知关系';
  }

  return getChineseKinshipTerm(fromPerson, toPerson, path);
}
