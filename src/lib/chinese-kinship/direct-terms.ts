import type { GenderKey, KinshipSide } from './types';
import { KINSHIP_TERMS } from './constants';

export function getParentChildTerm(
  fromGender: GenderKey,
  toGender: GenderKey,
  isParent: boolean
): string {
  if (isParent) {
    switch (toGender) {
      case 'MALE': return KINSHIP_TERMS.BASIC.SON;
      case 'FEMALE': return KINSHIP_TERMS.BASIC.DAUGHTER;
      default: return KINSHIP_TERMS.BASIC.CHILD;
    }
  } else {
    switch (toGender) {
      case 'MALE': return KINSHIP_TERMS.BASIC.FATHER;
      case 'FEMALE': return KINSHIP_TERMS.BASIC.MOTHER;
      default: return KINSHIP_TERMS.BASIC.PARENT;
    }
  }
}

export function getSpouseTerm(
  fromGender: GenderKey,
  toGender: GenderKey
): string {
  if (fromGender === 'MALE' && toGender === 'FEMALE') {
    return KINSHIP_TERMS.BASIC.WIFE;
  } else if (fromGender === 'FEMALE' && toGender === 'MALE') {
    return KINSHIP_TERMS.BASIC.HUSBAND;
  }
  return KINSHIP_TERMS.BASIC.SPOUSE;
}

export function getGrandparentTerm(toGender: GenderKey, side?: KinshipSide): string {
  if (side === 'MATERNAL') {
    return toGender === 'MALE' ? KINSHIP_TERMS.BASIC.GRANDFATHER_MATERNAL : KINSHIP_TERMS.BASIC.GRANDMOTHER_MATERNAL;
  }
  return toGender === 'MALE' ? KINSHIP_TERMS.BASIC.GRANDFATHER_PATERNAL : KINSHIP_TERMS.BASIC.GRANDMOTHER_PATERNAL;
}

export function getGrandchildTerm(toGender: GenderKey, fromGender?: GenderKey): string {
  if (fromGender === 'FEMALE') {
    return toGender === 'MALE' ? KINSHIP_TERMS.BASIC.GRANDSON_MATERNAL : KINSHIP_TERMS.BASIC.GRANDDAUGHTER_MATERNAL;
  }
  return toGender === 'MALE' ? KINSHIP_TERMS.BASIC.GRANDSON_PATERNAL : KINSHIP_TERMS.BASIC.GRANDDAUGHTER_PATERNAL;
}

export function getGreatGrandparentTerm(toGender: GenderKey, side?: KinshipSide): string {
  if (side === 'MATERNAL') {
    return toGender === 'MALE' ? KINSHIP_TERMS.BASIC.GREAT_GRANDFATHER_MATERNAL : KINSHIP_TERMS.BASIC.GREAT_GRANDMOTHER_MATERNAL;
  }
  return toGender === 'MALE' ? KINSHIP_TERMS.BASIC.GREAT_GRANDFATHER_PATERNAL : KINSHIP_TERMS.BASIC.GREAT_GRANDMOTHER_PATERNAL;
}

export function getGreatGrandchildTerm(toGender: GenderKey): string {
  return toGender === 'MALE' ? KINSHIP_TERMS.BASIC.GREAT_GRANDSON_PATERNAL : KINSHIP_TERMS.BASIC.GREAT_GRANDDAUGHTER_PATERNAL;
}

export function getGreatGreatGrandparentTerm(toGender: GenderKey, side?: KinshipSide): string {
  if (side === 'MATERNAL') {
    return toGender === 'MALE' ? KINSHIP_TERMS.BASIC.GREAT_GREAT_GRANDFATHER_MATERNAL : KINSHIP_TERMS.BASIC.GREAT_GREAT_GRANDMOTHER_MATERNAL;
  }
  return toGender === 'MALE' ? KINSHIP_TERMS.BASIC.GREAT_GREAT_GRANDFATHER_PATERNAL : KINSHIP_TERMS.BASIC.GREAT_GREAT_GRANDMOTHER_PATERNAL;
}

export function getGreatGreatGrandchildTerm(toGender: GenderKey): string {
  return toGender === 'MALE' ? KINSHIP_TERMS.BASIC.GREAT_GREAT_GRANDSON : KINSHIP_TERMS.BASIC.GREAT_GREAT_GRANDDAUGHTER;
}

export function getAdoptiveParentTerm(toGender: GenderKey): string {
  return toGender === 'MALE' ? KINSHIP_TERMS.BASIC.FATHER_ADOPTIVE : KINSHIP_TERMS.BASIC.MOTHER_ADOPTIVE;
}

export function getAdoptedChildTerm(toGender: GenderKey): string {
  return toGender === 'MALE' ? KINSHIP_TERMS.BASIC.SON_ADOPTED : KINSHIP_TERMS.BASIC.DAUGHTER_ADOPTED;
}

export function getFosterParentTerm(toGender: GenderKey): string {
  return toGender === 'MALE' ? KINSHIP_TERMS.BASIC.FATHER_FOSTER : KINSHIP_TERMS.BASIC.MOTHER_FOSTER;
}

export function getFosterChildTerm(toGender: GenderKey): string {
  return toGender === 'MALE' ? KINSHIP_TERMS.BASIC.SON_FOSTER : KINSHIP_TERMS.BASIC.DAUGHTER_FOSTER;
}

export function getStepparentTerm(toGender: GenderKey): string {
  return toGender === 'MALE' ? KINSHIP_TERMS.BASIC.FATHER_STEP : KINSHIP_TERMS.BASIC.MOTHER_STEP;
}

export function getStepchildTerm(toGender: GenderKey): string {
  return toGender === 'MALE' ? KINSHIP_TERMS.BASIC.SON : KINSHIP_TERMS.BASIC.DAUGHTER;
}

export function getConcubineTerm(fromGender: GenderKey): string {
  return fromGender === 'MALE' ? KINSHIP_TERMS.BASIC.CONCUBINE : KINSHIP_TERMS.BASIC.CONCUBINE_HUSBAND;
}

export function getBetrothedTerm(fromGender: GenderKey): string {
  return fromGender === 'MALE' ? KINSHIP_TERMS.BASIC.BETROTHED_FEMALE : KINSHIP_TERMS.BASIC.BETROTHED_MALE;
}

export function getDynamicGrandparentTerm(gen: number, toGender: GenderKey, side?: KinshipSide): string {
  const prefix = side === 'MATERNAL' ? '外' : '';
  if (gen === 2) {
    return toGender === 'MALE' ? `${prefix}祖父` : `${prefix}祖母`;
  }
  if (gen === 3) {
    return toGender === 'MALE' ? `${prefix}曾祖父` : `${prefix}曾祖母`;
  }
  if (gen === 4) {
    return toGender === 'MALE' ? `${prefix}高祖父` : `${prefix}高祖母`;
  }
  return toGender === 'MALE' ? `第${gen}代${prefix}祖父` : `第${gen}代${prefix}祖母`;
}

export function getDynamicGrandchildTerm(gen: number, toGender: GenderKey, fromGender?: GenderKey): string {
  const isMaternal = fromGender === 'FEMALE';
  const prefix = isMaternal ? '外' : '';
  if (gen === 2) {
    return toGender === 'MALE' ? `${prefix}孙` : `${prefix}孙女`;
  }
  if (gen === 3) {
    return toGender === 'MALE' ? `${prefix}曾孙` : `${prefix}曾孙女`;
  }
  if (gen === 4) {
    return toGender === 'MALE' ? `${prefix}玄孙` : `${prefix}玄孙女`;
  }
  return toGender === 'MALE' ? `第${gen}代${prefix}孙` : `第${gen}代${prefix}孙女`;
}
