import { describe, expect, it } from 'vitest';
import { closeKinIds } from '../kinship-scope';
import { RelationshipType as T, type Relationship } from '@/types';

let n = 0;
const R = (a: string, b: string, type = T.PARENT_CHILD): Relationship => ({
  id: `r${n++}`,
  personAId: a,
  personBId: b,
  type,
  createdBy: 'u',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

// ggg → gg → g → {f, u}; f → {me, sis}; u → cousin → cousinKid; me → kid → gkid → ggkid → gggkid;
// sis → niece → grandniece → greatGrandniece
const relationships = [
  R('ggg', 'gg'), R('gg', 'g'), R('g', 'f'), R('g', 'u'), R('f', 'me'), R('f', 'sis'), R('u', 'cousin'), R('cousin', 'cousinKid'),
  R('ggkid', 'gggkid'), R('grandniece', 'greatGrandniece'), R('ggg', 'gggSon'),
  R('me', 'kid'), R('kid', 'gkid'), R('gkid', 'ggkid'), R('sis', 'niece'), R('niece', 'grandniece'),
  R('aunt', 'u', T.SPOUSE), R('wife', 'me', T.SPOUSE), R('concubine', 'me', T.CONCUBINE), R('wifeFather', 'wife'),
  R('kidWife', 'kid', T.SPOUSE), R('kidWifeMother', 'kidWife'), R('g', 'greatUncle', T.SIBLING),
  R('greatUncle', 'secondUncle'), R('secondUncle', 'secondCousin'), R('secondCousin', 'secondCousinKid'),
];
const close = closeKinIds('me', relationships);

describe('closeKinIds', () => {
  it('includes lineal relatives within 四代 and collateral relatives within 四代', () => {
    ['f', 'g', 'gg', 'kid', 'gkid', 'ggkid', 'sis', 'u', 'cousin', 'niece', 'grandniece', 'cousinKid'].forEach((id) =>
      expect(close.has(id)).toBe(true)
    );
    ['greatUncle', 'secondUncle', 'secondCousin'].forEach((id) => expect(close.has(id)).toBe(true));
  });

  it('includes spouses, in-laws and spouses of close relatives', () => {
    ['wife', 'concubine', 'wifeFather', 'kidWife', 'aunt'].forEach((id) => expect(close.has(id)).toBe(true));
  });

  it('leaves out relatives beyond 四代 and relatives joined through a marriage in the middle', () => {
    ['ggg', 'gggSon', 'gggkid', 'greatGrandniece', 'secondCousinKid', 'kidWifeMother'].forEach((id) =>
      expect(close.has(id)).toBe(false)
    );
  });
});
