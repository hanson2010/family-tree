import {
  GenerationCalculator,
  getRelationshipDirection,
  getRelationshipLabel,
} from '../generation-calculator';
import type { Person, Relationship } from '@/types';
import { Gender, RelationshipType } from '@/types';

// Mock data for testing
const createMockPerson = (id: string, name: string, gender: Gender = Gender.MALE): Person => ({
  id,
  name,
  gender,
  isPrivate: false,
  createdBy: 'test-user',
  createdAt: new Date(),
  updatedAt: new Date(),
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
  createdAt: new Date(),
  updatedAt: new Date(),
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

  describe('getVisiblePersons', () => {
    it('should return only persons within visible range', () => {
      const g3Grandparent = createMockPerson('g3', 'G3 Grandparent');
      const g2Grandparent = createMockPerson('g2', 'G2 Grandparent');
      const g1Parent = createMockPerson('g1', 'G1 Parent');
      const center = createMockPerson('center', 'Center');
      const d1Child = createMockPerson('d1', 'D1 Child');
      const d2Grandchild = createMockPerson('d2', 'D2 Grandchild');
      const d3GreatGrandchild = createMockPerson('d3', 'D3 Great Grandchild');
      const d4 = createMockPerson('d4', 'D4');

      const relationships = [
        createMockRelationship('g3', 'g2', RelationshipType.PARENT_CHILD),
        createMockRelationship('g2', 'g1', RelationshipType.PARENT_CHILD),
        createMockRelationship('g1', 'center', RelationshipType.PARENT_CHILD),
        createMockRelationship('center', 'd1', RelationshipType.PARENT_CHILD),
        createMockRelationship('d1', 'd2', RelationshipType.PARENT_CHILD),
        createMockRelationship('d2', 'd3', RelationshipType.PARENT_CHILD),
        createMockRelationship('d3', 'd4', RelationshipType.PARENT_CHILD),
      ];

      const calculator = new GenerationCalculator(
        [g3Grandparent, g2Grandparent, g1Parent, center, d1Child, d2Grandchild, d3GreatGrandchild, d4],
        relationships
      );

      const visiblePersons = calculator.getVisiblePersons('center', 2, 3);
      const visibleIds = visiblePersons.map(p => p.id);

      expect(visibleIds).toContain('g2'); // gen -2
      expect(visibleIds).toContain('g1'); // gen -1
      expect(visibleIds).toContain('center'); // gen 0
      expect(visibleIds).toContain('d1'); // gen 1
      expect(visibleIds).toContain('d2'); // gen 2
      expect(visibleIds).toContain('d3'); // gen 3
      expect(visibleIds).not.toContain('g3'); // gen -3, out of range
      expect(visibleIds).not.toContain('d4'); // gen 4, out of range
    });

    it('should set relativeGeneration property on visible persons', () => {
      const parent = createMockPerson('p', 'Parent');
      const child = createMockPerson('c', 'Child');

      const relationships = [createMockRelationship('p', 'c', RelationshipType.PARENT_CHILD)];

      const calculator = new GenerationCalculator([parent, child], relationships);
      const visiblePersons = calculator.getVisiblePersons('c', 1, 1);

      const parentPerson = visiblePersons.find(p => p.id === 'p');
      const childPerson = visiblePersons.find(p => p.id === 'c');

      expect(parentPerson?.relativeGeneration).toBe(-1);
      expect(childPerson?.relativeGeneration).toBe(0);
    });
  });

  describe('getVisibleRelationships', () => {
    it('should return only relationships between visible persons', () => {
      const p1 = createMockPerson('p1', 'Person 1');
      const p2 = createMockPerson('p2', 'Person 2');
      const p3 = createMockPerson('p3', 'Person 3');

      const relationships = [
        createMockRelationship('p1', 'p2', RelationshipType.SPOUSE),
        createMockRelationship('p2', 'p3', RelationshipType.PARENT_CHILD),
      ];

      const calculator = new GenerationCalculator([p1, p2, p3], relationships);
      const visibleIds = new Set(['p1', 'p2']);

      const visibleRelationships = calculator.getVisibleRelationships(visibleIds);

      expect(visibleRelationships).toHaveLength(1);
      expect(visibleRelationships[0].personAId).toBe('p1');
      expect(visibleRelationships[0].personBId).toBe('p2');
    });
  });

  describe('getDisplayOrder', () => {
    it('should order males before females in same generation', () => {
      expect(GenerationCalculator.getDisplayOrder(Gender.MALE, 0)).toBeLessThan(
        GenerationCalculator.getDisplayOrder(Gender.FEMALE, 0)
      );
    });

    it('should order earlier generations first', () => {
      expect(GenerationCalculator.getDisplayOrder(Gender.MALE, -1)).toBeLessThan(
        GenerationCalculator.getDisplayOrder(Gender.MALE, 0)
      );
    });

    it('should return consistent order values', () => {
      const maleOrder = GenerationCalculator.getDisplayOrder(Gender.MALE, 0);
      const femaleOrder = GenerationCalculator.getDisplayOrder(Gender.FEMALE, 0);
      const otherOrder = GenerationCalculator.getDisplayOrder(Gender.UNKNOWN, 0);

      // Order values are based on generation * 10 + gender order
      // For generation 0: male=0, female=1, unknown=2
      expect(maleOrder).toBe(0);
      expect(femaleOrder).toBe(1);
      expect(otherOrder).toBe(2);
    });
  });
});

describe('getRelationshipDirection', () => {
  it('should return correct direction for parent-child relationship', () => {
    const relationship = createMockRelationship('parent', 'child', RelationshipType.PARENT_CHILD);

    const parentView = getRelationshipDirection(relationship, 'parent');
    expect(parentView.direction).toBe('child');
    expect(parentView.otherPersonId).toBe('child');

    const childView = getRelationshipDirection(relationship, 'child');
    expect(childView.direction).toBe('parent');
    expect(childView.otherPersonId).toBe('parent');
  });

  it('should return correct direction for spouse relationship', () => {
    const relationship = createMockRelationship('h', 'w', RelationshipType.SPOUSE);

    const husbandView = getRelationshipDirection(relationship, 'h');
    expect(husbandView.direction).toBe('spouse');
    expect(husbandView.otherPersonId).toBe('w');
  });

  it('should return correct direction for sibling relationship', () => {
    const relationship = createMockRelationship('s1', 's2', RelationshipType.SIBLING);

    const sibling1View = getRelationshipDirection(relationship, 's1');
    expect(sibling1View.direction).toBe('sibling');
    expect(sibling1View.otherPersonId).toBe('s2');
  });

  it('should handle adoptive parent relationship', () => {
    const relationship = createMockRelationship('adopter', 'adopted', RelationshipType.ADOPTIVE_PARENT);

    const adopterView = getRelationshipDirection(relationship, 'adopter');
    expect(adopterView.direction).toBe('child');

    const adoptedView = getRelationshipDirection(relationship, 'adopted');
    expect(adoptedView.direction).toBe('parent');
  });
});

describe('getRelationshipLabel', () => {
  it('should return correct labels for parent-child relationships', () => {
    expect(getRelationshipLabel(RelationshipType.PARENT_CHILD, Gender.MALE, Gender.MALE)).toBe('儿子');
    expect(getRelationshipLabel(RelationshipType.PARENT_CHILD, Gender.MALE, Gender.FEMALE)).toBe('女儿');
    expect(getRelationshipLabel(RelationshipType.PARENT_CHILD, Gender.FEMALE, Gender.MALE)).toBe('儿子');
    expect(getRelationshipLabel(RelationshipType.PARENT_CHILD, Gender.FEMALE, Gender.FEMALE)).toBe('女儿');
  });

  it('should return correct labels for sibling relationships', () => {
    expect(getRelationshipLabel(RelationshipType.SIBLING, Gender.MALE, Gender.MALE)).toBe('兄弟');
    expect(getRelationshipLabel(RelationshipType.SIBLING, Gender.MALE, Gender.FEMALE)).toBe('姐妹');
    expect(getRelationshipLabel(RelationshipType.SIBLING, Gender.FEMALE, Gender.MALE)).toBe('兄弟');
    expect(getRelationshipLabel(RelationshipType.SIBLING, Gender.FEMALE, Gender.FEMALE)).toBe('姐妹');
  });

  it('should return correct labels for half-sibling relationships', () => {
    expect(getRelationshipLabel(RelationshipType.HALF_SIBLING, Gender.MALE, Gender.MALE)).toBe('同父异母兄弟');
    expect(getRelationshipLabel(RelationshipType.HALF_SIBLING, Gender.MALE, Gender.FEMALE)).toBe('同父异母姐妹');
  });

  it('should return correct labels for spouse relationships', () => {
    expect(getRelationshipLabel(RelationshipType.SPOUSE, Gender.MALE, Gender.FEMALE)).toBe('妻子');
    expect(getRelationshipLabel(RelationshipType.SPOUSE, Gender.FEMALE, Gender.MALE)).toBe('丈夫');
  });

  it('should return correct labels for betrothed relationships', () => {
    expect(getRelationshipLabel(RelationshipType.BETROTHED, Gender.MALE, Gender.FEMALE)).toBe('未婚妻');
    expect(getRelationshipLabel(RelationshipType.BETROTHED, Gender.FEMALE, Gender.MALE)).toBe('未婚夫');
  });

  it('should return correct labels for sworn sibling relationships', () => {
    expect(getRelationshipLabel(RelationshipType.SWORN_SIBLING, Gender.MALE, Gender.MALE)).toBe('结拜兄弟');
    expect(getRelationshipLabel(RelationshipType.SWORN_SIBLING, Gender.MALE, Gender.FEMALE)).toBe('结拜姐妹');
  });

  it('should return lowercase type for unknown combinations', () => {
    // Unknown gender combination for SPOUSE
    const result = getRelationshipLabel(RelationshipType.SPOUSE, Gender.MALE, Gender.MALE);
    expect(result).toBe('配偶');
  });
});
