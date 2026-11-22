import { Gender, RelationshipType } from '@/types';

/** Marriages stored with a fixed order of the two persons */
export const ORDERED_MARRIAGE_TYPES: RelationshipType[] = [RelationshipType.SPOUSE, RelationshipType.CONCUBINE];

/**
 * Whether a marriage's two persons must swap places to follow the stored order: the woman is
 * person A (the wife, or the concubine, "甲是乙的妾"), the man person B. Persons of the same
 * gender, or of unknown gender, keep the order given.
 */
export function shouldSwapPartners(type: RelationshipType, genderA?: Gender, genderB?: Gender): boolean {
  return ORDERED_MARRIAGE_TYPES.includes(type) && genderA === Gender.MALE && genderB === Gender.FEMALE;
}
