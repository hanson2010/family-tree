import { describe, expect, it } from 'vitest';
import { shouldSwapPartners } from '../relationship-direction';
import { Gender, RelationshipType } from '@/types';

const { MALE, FEMALE, UNKNOWN } = Gender;

describe('shouldSwapPartners', () => {
  it('puts the woman first in a spouse or concubine relationship', () => {
    expect(shouldSwapPartners(RelationshipType.SPOUSE, MALE, FEMALE)).toBe(true);
    expect(shouldSwapPartners(RelationshipType.CONCUBINE, MALE, FEMALE)).toBe(true);
    expect(shouldSwapPartners(RelationshipType.SPOUSE, FEMALE, MALE)).toBe(false);
    expect(shouldSwapPartners(RelationshipType.CONCUBINE, FEMALE, MALE)).toBe(false);
  });

  it('keeps the order for same-sex marriages and unknown genders', () => {
    expect(shouldSwapPartners(RelationshipType.SPOUSE, MALE, MALE)).toBe(false);
    expect(shouldSwapPartners(RelationshipType.SPOUSE, FEMALE, FEMALE)).toBe(false);
    expect(shouldSwapPartners(RelationshipType.SPOUSE, MALE, UNKNOWN)).toBe(false);
    expect(shouldSwapPartners(RelationshipType.CONCUBINE, UNKNOWN, FEMALE)).toBe(false);
    expect(shouldSwapPartners(RelationshipType.SPOUSE, undefined, FEMALE)).toBe(false);
  });

  it('leaves other relationships alone', () => {
    expect(shouldSwapPartners(RelationshipType.PARENT_CHILD, MALE, FEMALE)).toBe(false);
    expect(shouldSwapPartners(RelationshipType.BETROTHED, MALE, FEMALE)).toBe(false);
  });
});
