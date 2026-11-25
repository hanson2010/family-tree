import { describe, expect, it } from 'vitest';
import { GenerationCalculator } from '../generation-calculator';
import type { Person, Relationship } from '@/types';
import { Gender, RelationshipType } from '@/types';

// Mock data for testing
const createMockPerson = (id: string, name: string, gender: Gender = Gender.MALE): Person => ({
  id,
  name,
  gender,
  isPrivate: false,
  createdBy: 'test-user',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const createMockRelationship = (
  personAId: string,
  personBId: string,
  type: RelationshipType
): Relationship => ({
  id: `rel-${personAId}-${personBId}`,
  personAId,
  personBId,
  type,
  createdBy: 'test-user',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('GenerationCalculator', () => {
  describe('calculateRelativeGenerations', () => {
    it('should assign generation 0 to center person', () => {
      const person = createMockPerson('p1', 'John');
      const calculator = new GenerationCalculator([person], []);

      const generations = calculator.calculateRelativeGenerations('p1');

      expect(generations.get('p1')).toBe(0);
    });

    it('should calculate parent-child generations correctly', () => {
      const grandparent = createMockPerson('gp', 'Grandpa');
      const parent = createMockPerson('p', 'Parent');
      const child = createMockPerson('c', 'Child');

      const relationships = [
        createMockRelationship('gp', 'p', RelationshipType.PARENT_CHILD), // gp is parent of p
        createMockRelationship('p', 'c', RelationshipType.PARENT_CHILD), // p is parent of c
      ];

      const calculator = new GenerationCalculator([grandparent, parent, child], relationships);
      const generations = calculator.calculateRelativeGenerations('p');

      expect(generations.get('p')).toBe(0); // center
      expect(generations.get('gp')).toBe(-1); // parent's parent = -1
      expect(generations.get('c')).toBe(1); // parent's child = +1
    });

    it('should place siblings in the same generation', () => {
      const person1 = createMockPerson('s1', 'Sibling 1');
      const person2 = createMockPerson('s2', 'Sibling 2');

      const relationships = [createMockRelationship('s1', 's2', RelationshipType.SIBLING)];

      const calculator = new GenerationCalculator([person1, person2], relationships);
      const generations = calculator.calculateRelativeGenerations('s1');

      expect(generations.get('s1')).toBe(0);
      expect(generations.get('s2')).toBe(0);
    });

    it('should place spouses in the same generation', () => {
      const husband = createMockPerson('h', 'Husband', Gender.MALE);
      const wife = createMockPerson('w', 'Wife', Gender.FEMALE);

      const relationships = [createMockRelationship('h', 'w', RelationshipType.SPOUSE)];

      const calculator = new GenerationCalculator([husband, wife], relationships);
      const generations = calculator.calculateRelativeGenerations('h');

      expect(generations.get('h')).toBe(0);
      expect(generations.get('w')).toBe(0);
    });

    it('should handle complex family tree', () => {
      const grandpa = createMockPerson('gp', 'Grandpa', Gender.MALE);
      const grandma = createMockPerson('gm', 'Grandma', Gender.FEMALE);
      const dad = createMockPerson('dad', 'Dad', Gender.MALE);
      const mom = createMockPerson('mom', 'Mom', Gender.FEMALE);
      const child1 = createMockPerson('c1', 'Child 1', Gender.MALE);
      const child2 = createMockPerson('c2', 'Child 2', Gender.FEMALE);

      const relationships = [
        createMockRelationship('gp', 'gm', RelationshipType.SPOUSE),
        createMockRelationship('gp', 'dad', RelationshipType.PARENT_CHILD),
        createMockRelationship('dad', 'mom', RelationshipType.SPOUSE),
        createMockRelationship('dad', 'c1', RelationshipType.PARENT_CHILD),
        createMockRelationship('dad', 'c2', RelationshipType.PARENT_CHILD),
        createMockRelationship('c1', 'c2', RelationshipType.SIBLING),
      ];

      const calculator = new GenerationCalculator(
        [grandpa, grandma, dad, mom, child1, child2],
        relationships
      );
      const generations = calculator.calculateRelativeGenerations('dad');

      expect(generations.get('dad')).toBe(0);
      expect(generations.get('mom')).toBe(0);
      expect(generations.get('gp')).toBe(-1);
      expect(generations.get('gm')).toBe(-1);
      expect(generations.get('c1')).toBe(1);
      expect(generations.get('c2')).toBe(1);
    });

    it('should handle adoptive parent relationships', () => {
      const adoptiveParent = createMockPerson('ap', 'Adoptive Parent');
      const adoptedChild = createMockPerson('ac', 'Adopted Child');

      const relationships = [createMockRelationship('ap', 'ac', RelationshipType.ADOPTIVE_PARENT)];

      const calculator = new GenerationCalculator([adoptiveParent, adoptedChild], relationships);
      const generations = calculator.calculateRelativeGenerations('ap');

      expect(generations.get('ap')).toBe(0);
      expect(generations.get('ac')).toBe(1);
    });

    it('should handle half-sibling relationships', () => {
      const halfSibling1 = createMockPerson('hs1', 'Half Sibling 1');
      const halfSibling2 = createMockPerson('hs2', 'Half Sibling 2');

      const relationships = [createMockRelationship('hs1', 'hs2', RelationshipType.HALF_SIBLING)];

      const calculator = new GenerationCalculator([halfSibling1, halfSibling2], relationships);
      const generations = calculator.calculateRelativeGenerations('hs1');

      expect(generations.get('hs1')).toBe(0);
      expect(generations.get('hs2')).toBe(0);
    });
  });

});
