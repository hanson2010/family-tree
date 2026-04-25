import type { Person } from '@/types';
import type { RelationshipPath, GenderKey } from './types';
import { KinshipRelationshipType } from './types';
import { getGenderKey } from './path-finder';
import { KINSHIP_TERMS } from './constants';
import {
  getParentChildTerm,
  getSpouseTerm,
  getGrandparentTerm,
  getGrandchildTerm,
  getGreatGrandparentTerm,
  getGreatGrandchildTerm,
  getGreatGreatGrandparentTerm,
  getGreatGreatGrandchildTerm,
  getAdoptiveParentTerm,
  getAdoptedChildTerm,
  getFosterParentTerm,
  getFosterChildTerm,
  getStepparentTerm,
  getStepchildTerm,
  getConcubineTerm,
  getBetrothedTerm,
  getDynamicGrandparentTerm,
  getDynamicGrandchildTerm,
} from './direct-terms';
import {
  getSiblingTerm,
  getHalfSiblingTerm,
  getSwornSiblingTerm,
  getAuntUncleTerm,
  getAuntUncleSpouseTerm,
  getGreatAuntUncleTerm,
  getGreatGreatAuntUncleTerm,
  getNephewNieceTerm,
  getGreatNephewNieceTerm,
  getGreatGreatNephewNieceTerm,
  getCousinTerm,
  getCousinGenericTerm,
  getParentInLawTerm,
  getChildInLawTerm,
  getSiblingInLawTerm,
  getSpouseSiblingTerm,
  getSiblingsSpouseMutualTerm,
} from './collateral-terms';

export function getChineseKinshipTerm(
  fromPerson: Person,
  toPerson: Person,
  path: RelationshipPath,
  additionalContext?: {
    side?: 'PATERNAL' | 'MATERNAL';
    isOlder?: boolean;
    spouseOf?: string;
    siblingRank?: { rank: number; total: number };
  }
): string {
  const fromGender = getGenderKey(fromPerson.gender);
  const toGender = getGenderKey(toPerson.gender);
  const { relationshipType, grandparentSide } = path;
  const side = path.side ?? additionalContext?.side;
  const isOlder = path.isOlder ?? additionalContext?.isOlder;
  const siblingRank = additionalContext?.siblingRank;

  switch (relationshipType) {
    case KinshipRelationshipType.PARENT:
      return getParentChildTerm(fromGender, toGender, true);

    case KinshipRelationshipType.CHILD:
      return getParentChildTerm(fromGender, toGender, false);

    case KinshipRelationshipType.SIBLING:
      return getSiblingTerm(fromGender, toGender, isOlder, siblingRank);

    case KinshipRelationshipType.HALF_SIBLING:
      return getHalfSiblingTerm(toGender, isOlder);

    case KinshipRelationshipType.SPOUSE:
      return getSpouseTerm(fromGender, toGender);

    case KinshipRelationshipType.CONCUBINE:
      return getConcubineTerm(fromGender);

    case KinshipRelationshipType.BETROTHED:
      return getBetrothedTerm(fromGender);

    case KinshipRelationshipType.ADOPTIVE_PARENT:
      return getAdoptiveParentTerm(toGender);

    case KinshipRelationshipType.ADOPTED_CHILD:
      return getAdoptedChildTerm(toGender);

    case KinshipRelationshipType.FOSTER_PARENT:
      return getFosterParentTerm(toGender);

    case KinshipRelationshipType.FOSTER_CHILD:
      return getFosterChildTerm(toGender);

    case KinshipRelationshipType.STEPPARENT:
      return getStepparentTerm(toGender);

    case KinshipRelationshipType.STEPCHILD:
      return getStepchildTerm(toGender);

    case KinshipRelationshipType.SWORN_SIBLING:
      return getSwornSiblingTerm(toGender, isOlder);

    case KinshipRelationshipType.GRANDPARENT:
      return getGrandparentTerm(toGender, side);

    case KinshipRelationshipType.GRANDCHILD:
      return getGrandchildTerm(toGender, fromGender);

    case KinshipRelationshipType.GREAT_GRANDPARENT:
      return getGreatGrandparentTerm(toGender, side);

    case KinshipRelationshipType.GREAT_GRANDCHILD:
      return getGreatGrandchildTerm(toGender);

    case KinshipRelationshipType.GREAT_GREAT_GRANDPARENT:
      return getGreatGreatGrandparentTerm(toGender, side);

    case KinshipRelationshipType.GREAT_GREAT_GRANDCHILD:
      return getGreatGreatGrandchildTerm(toGender);

    case KinshipRelationshipType.AUNT_UNCLE:
      if (side) {
        return getAuntUncleTerm(fromGender, toGender, side, isOlder, siblingRank);
      }
      if (toGender === 'MALE') {
        return isOlder ? KINSHIP_TERMS.PATERNAL.UNCLE_OLDER : KINSHIP_TERMS.PATERNAL.UNCLE_YOUNGER;
      } else {
        return KINSHIP_TERMS.PATERNAL.AUNT;
      }

    case KinshipRelationshipType.AUNT_UNCLE_SPOUSE:
      return getAuntUncleSpouseTerm(toGender, side, isOlder);

    case KinshipRelationshipType.GREAT_AUNT_UNCLE:
      return getGreatAuntUncleTerm(toGender, grandparentSide, isOlder);

    case KinshipRelationshipType.GREAT_GREAT_AUNT_UNCLE:
      return getGreatGreatAuntUncleTerm(toGender, grandparentSide, isOlder);

    case KinshipRelationshipType.NEPHEW_NIECE:
      return getNephewNieceTerm(toGender, fromGender);

    case KinshipRelationshipType.GREAT_NEPHEW_NIECE:
      return getGreatNephewNieceTerm(toGender, fromGender);

    case KinshipRelationshipType.GREAT_GREAT_NEPHEW_NIECE:
      return getGreatGreatNephewNieceTerm(toGender, fromGender);

    case KinshipRelationshipType.COUSIN:
      if (side) {
        return getCousinTerm(fromGender, toGender, side, isOlder);
      }
      return getCousinGenericTerm(toGender, isOlder);

    case KinshipRelationshipType.PARENT_IN_LAW:
      return getParentInLawTerm(fromGender, toGender);

    case KinshipRelationshipType.CHILD_IN_LAW:
      return getChildInLawTerm(toGender);

    case KinshipRelationshipType.SIBLING_IN_LAW:
      return getSiblingInLawTerm(toGender, isOlder);

    case KinshipRelationshipType.SPOUSE_SIBLING:
      return getSpouseSiblingTerm(fromGender, toGender, isOlder);

    case KinshipRelationshipType.SIBLINGS_SPOUSE_MUTUAL:
      return getSiblingsSpouseMutualTerm(fromGender, toGender);

    case KinshipRelationshipType.SISTER_IN_LAW_SPOUSE:
      return KINSHIP_TERMS.IN_LAW.SISTER_SPOUSE;

    case KinshipRelationshipType.BROTHERS_WIFE:
      return getSiblingInLawTerm('FEMALE', isOlder);

    case KinshipRelationshipType.BROTERS_HUSBAND:
    case KinshipRelationshipType.SISTERS_HUSBAND:
      return getSiblingInLawTerm('MALE', isOlder);

    case KinshipRelationshipType.UNKNOWN:
      return KINSHIP_TERMS.BASIC.RELATIVE;

    default:
      if (typeof relationshipType === 'string') {
        if (relationshipType.startsWith('GRANDPARENT_')) {
          const gen = parseInt(relationshipType.split('_')[1]) || 2;
          return getDynamicGrandparentTerm(gen, toGender, side);
        }
        if (relationshipType.startsWith('GRANDCHILD_')) {
          const gen = parseInt(relationshipType.split('_')[1]) || 2;
          return getDynamicGrandchildTerm(gen, toGender, fromGender);
        }
      }
      return KINSHIP_TERMS.BASIC.RELATIVE;
  }
}

export {
  getParentChildTerm,
  getSiblingTerm,
  getSpouseTerm,
  getAuntUncleTerm,
  getCousinTerm,
  getNephewNieceTerm,
};
