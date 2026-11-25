import type { Person, Relationship } from '@/types';
import { RelationshipType as RelType } from '@/types';

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
}
