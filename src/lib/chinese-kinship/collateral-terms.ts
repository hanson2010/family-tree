import type { GenderKey, KinshipSide, GrandparentSide } from './types';
import { KINSHIP_TERMS, EXTENDED_KINSHIP_TERMS } from './constants';

export function getSiblingTerm(
  fromGender: GenderKey,
  toGender: GenderKey,
  isOlder?: boolean,
  siblingRank?: { rank: number; total: number }
): string {
  if (siblingRank && siblingRank.total > 1) {
    const prefix = getRankPrefix(siblingRank.rank, siblingRank.total);
    if (toGender === 'MALE') {
      return `${prefix}${isOlder ? '哥' : '弟'}`;
    } else {
      return `${prefix}${isOlder ? '姐' : '妹'}`;
    }
  }

  if (fromGender === 'MALE' || fromGender === 'FEMALE') {
    switch (toGender) {
      case 'MALE':
        return isOlder ? KINSHIP_TERMS.BASIC.BROTHER_OLDER : KINSHIP_TERMS.BASIC.BROTHER_YOUNGER;
      case 'FEMALE':
        return isOlder ? KINSHIP_TERMS.BASIC.SISTER_OLDER : KINSHIP_TERMS.BASIC.SISTER_YOUNGER;
      default:
        return KINSHIP_TERMS.BASIC.SIBLINGS;
    }
  }
  return KINSHIP_TERMS.BASIC.SIBLINGS;
}

export function getHalfSiblingTerm(toGender: GenderKey, isOlder?: boolean): string {
  if (toGender === 'MALE') {
    return isOlder ? KINSHIP_TERMS.HALF_SIBLING.BROTHER_OLDER : KINSHIP_TERMS.HALF_SIBLING.BROTHER_YOUNGER;
  } else {
    return isOlder ? KINSHIP_TERMS.HALF_SIBLING.SISTER_OLDER : KINSHIP_TERMS.HALF_SIBLING.SISTER_YOUNGER;
  }
}

export function getSwornSiblingTerm(toGender: GenderKey, isOlder?: boolean): string {
  if (toGender === 'MALE') {
    return isOlder ? KINSHIP_TERMS.SWORN_SIBLING.BROTHER_OLDER : KINSHIP_TERMS.SWORN_SIBLING.BROTHER_YOUNGER;
  } else {
    return isOlder ? KINSHIP_TERMS.SWORN_SIBLING.SISTER_OLDER : KINSHIP_TERMS.SWORN_SIBLING.SISTER_YOUNGER;
  }
}

export function getAuntUncleTerm(
  fromGender: GenderKey,
  toGender: GenderKey,
  side: KinshipSide,
  isOlder?: boolean,
  siblingRank?: { rank: number; total: number }
): string {
  if (side === 'PATERNAL') {
    if (toGender === 'MALE') {
      return isOlder ? KINSHIP_TERMS.PATERNAL.UNCLE_OLDER : KINSHIP_TERMS.PATERNAL.UNCLE_YOUNGER;
    } else {
      if (siblingRank && siblingRank.total > 1) {
        const prefix = getRankPrefix(siblingRank.rank, siblingRank.total);
        return `${prefix}姑`;
      }
      return KINSHIP_TERMS.PATERNAL.AUNT;
    }
  } else {
    if (toGender === 'MALE') {
      if (siblingRank && siblingRank.total > 1) {
        const prefix = getRankPrefix(siblingRank.rank, siblingRank.total);
        return `${prefix}舅`;
      }
      return KINSHIP_TERMS.MATERNAL.UNCLE;
    } else {
      if (siblingRank && siblingRank.total > 1) {
        const prefix = getRankPrefix(siblingRank.rank, siblingRank.total);
        return `${prefix}姨`;
      }
      return KINSHIP_TERMS.MATERNAL.AUNT;
    }
  }
}

export function getAuntUncleSpouseTerm(
  toGender: GenderKey,
  side: KinshipSide | undefined,
  isOlder?: boolean
): string {
  if (side === 'PATERNAL') {
    if (toGender === 'FEMALE') {
      return isOlder ? KINSHIP_TERMS.PATERNAL.UNCLE_WIFE_OLDER : KINSHIP_TERMS.PATERNAL.UNCLE_WIFE_YOUNGER;
    } else {
      return KINSHIP_TERMS.PATERNAL.AUNT_HUSBAND;
    }
  } else if (side === 'MATERNAL') {
    if (toGender === 'FEMALE') {
      return KINSHIP_TERMS.MATERNAL.UNCLE_WIFE;
    } else {
      return KINSHIP_TERMS.MATERNAL.AUNT_HUSBAND;
    }
  }
  if (toGender === 'FEMALE') {
    return isOlder ? KINSHIP_TERMS.PATERNAL.UNCLE_WIFE_OLDER : KINSHIP_TERMS.PATERNAL.UNCLE_WIFE_YOUNGER;
  } else {
    return KINSHIP_TERMS.PATERNAL.AUNT_HUSBAND;
  }
}

export function getGreatAuntUncleTerm(
  toGender: GenderKey,
  grandparentSide: GrandparentSide | undefined,
  isOlder?: boolean
): string {
  if (grandparentSide === 'PATERNAL_GRANDFATHER') {
    return toGender === 'MALE'
      ? (isOlder ? KINSHIP_TERMS.PATERNAL.GREAT_UNCLE_OLDER : KINSHIP_TERMS.PATERNAL.GREAT_UNCLE_YOUNGER)
      : KINSHIP_TERMS.PATERNAL.GREAT_AUNT;
  } else if (grandparentSide === 'PATERNAL_GRANDMOTHER') {
    return toGender === 'MALE' ? KINSHIP_TERMS.MATERNAL.GREAT_UNCLE : KINSHIP_TERMS.PATERNAL.GREAT_AUNT;
  } else if (grandparentSide === 'MATERNAL_GRANDFATHER' || grandparentSide === 'MATERNAL_GRANDMOTHER') {
    return toGender === 'MALE' ? KINSHIP_TERMS.MATERNAL.GREAT_UNCLE : KINSHIP_TERMS.MATERNAL.GREAT_AUNT;
  }
  if (toGender === 'MALE') {
    return isOlder ? KINSHIP_TERMS.PATERNAL.GREAT_UNCLE_OLDER : KINSHIP_TERMS.PATERNAL.GREAT_UNCLE_YOUNGER;
  } else {
    return KINSHIP_TERMS.PATERNAL.GREAT_AUNT;
  }
}

export function getGreatGreatAuntUncleTerm(
  toGender: GenderKey,
  grandparentSide: GrandparentSide | undefined,
  isOlder?: boolean
): string {
  if (grandparentSide === 'PATERNAL_GRANDFATHER') {
    return toGender === 'MALE'
      ? (isOlder ? KINSHIP_TERMS.PATERNAL.GREAT_GREAT_UNCLE_OLDER : KINSHIP_TERMS.PATERNAL.GREAT_GREAT_UNCLE_YOUNGER)
      : KINSHIP_TERMS.PATERNAL.GREAT_GREAT_AUNT;
  } else if (grandparentSide === 'PATERNAL_GRANDMOTHER') {
    return toGender === 'MALE' ? KINSHIP_TERMS.MATERNAL.GREAT_GREAT_UNCLE : KINSHIP_TERMS.PATERNAL.GREAT_GREAT_AUNT;
  } else if (grandparentSide === 'MATERNAL_GRANDFATHER' || grandparentSide === 'MATERNAL_GRANDMOTHER') {
    return toGender === 'MALE' ? KINSHIP_TERMS.MATERNAL.GREAT_GREAT_UNCLE : KINSHIP_TERMS.MATERNAL.GREAT_GREAT_AUNT;
  }
  if (toGender === 'MALE') {
    return isOlder ? KINSHIP_TERMS.PATERNAL.GREAT_GREAT_UNCLE_OLDER : KINSHIP_TERMS.PATERNAL.GREAT_GREAT_UNCLE_YOUNGER;
  } else {
    return KINSHIP_TERMS.PATERNAL.GREAT_GREAT_AUNT;
  }
}

export function getNephewNieceTerm(toGender: GenderKey, fromGender: GenderKey): string {
  if (fromGender === 'MALE') {
    return toGender === 'MALE' ? KINSHIP_TERMS.PATERNAL.NEPHEW : KINSHIP_TERMS.PATERNAL.NIECE;
  } else {
    return toGender === 'MALE' ? KINSHIP_TERMS.MATERNAL.NEPHEW : KINSHIP_TERMS.MATERNAL.NIECE;
  }
}

export function getGreatNephewNieceTerm(toGender: GenderKey, fromGender: GenderKey): string {
  if (fromGender === 'MALE') {
    return toGender === 'MALE' ? KINSHIP_TERMS.PATERNAL.GREAT_NEPHEW : KINSHIP_TERMS.PATERNAL.GREAT_NIECE;
  } else {
    return toGender === 'MALE' ? KINSHIP_TERMS.MATERNAL.GREAT_NEPHEW : KINSHIP_TERMS.MATERNAL.GREAT_NIECE;
  }
}

export function getGreatGreatNephewNieceTerm(toGender: GenderKey, fromGender: GenderKey): string {
  if (fromGender === 'MALE') {
    return toGender === 'MALE' ? KINSHIP_TERMS.PATERNAL.GREAT_GREAT_NEPHEW : KINSHIP_TERMS.PATERNAL.GREAT_GREAT_NIECE;
  } else {
    return toGender === 'MALE' ? KINSHIP_TERMS.MATERNAL.GREAT_GREAT_NEPHEW : KINSHIP_TERMS.MATERNAL.GREAT_GREAT_NIECE;
  }
}

export function getCousinTerm(
  fromGender: GenderKey,
  toGender: GenderKey,
  side: KinshipSide,
  isOlder?: boolean
): string {
  const terms = side === 'PATERNAL' ? EXTENDED_KINSHIP_TERMS.PATERNAL : EXTENDED_KINSHIP_TERMS.MATERNAL;
  
  if (toGender === 'MALE') {
    return isOlder ? terms.COUSIN_BROTHER_OLDER : terms.COUSIN_BROTHER_YOUNGER;
  } else {
    return isOlder ? terms.COUSIN_SISTER_OLDER : terms.COUSIN_SISTER_YOUNGER;
  }
}

export function getCousinGenericTerm(toGender: GenderKey, isOlder?: boolean): string {
  if (toGender === 'MALE') {
    return isOlder ? KINSHIP_TERMS.COUSIN_GENERIC.BROTHER_OLDER : KINSHIP_TERMS.COUSIN_GENERIC.BROTHER_YOUNGER;
  } else {
    return isOlder ? KINSHIP_TERMS.COUSIN_GENERIC.SISTER_OLDER : KINSHIP_TERMS.COUSIN_GENERIC.SISTER_YOUNGER;
  }
}

export function getParentInLawTerm(fromGender: GenderKey, toGender: GenderKey): string {
  if (fromGender === 'MALE') {
    return toGender === 'MALE' ? KINSHIP_TERMS.SPOUSE_FAMILY.WIFE_FATHER : KINSHIP_TERMS.SPOUSE_FAMILY.WIFE_MOTHER;
  } else {
    return toGender === 'MALE' ? KINSHIP_TERMS.SPOUSE_FAMILY.HUSBAND_FATHER : KINSHIP_TERMS.SPOUSE_FAMILY.HUSBAND_MOTHER;
  }
}

export function getChildInLawTerm(toGender: GenderKey): string {
  return toGender === 'MALE' ? KINSHIP_TERMS.SPOUSE_FAMILY.SON_IN_LAW : KINSHIP_TERMS.SPOUSE_FAMILY.DAUGHTER_IN_LAW;
}

export function getSiblingInLawTerm(toGender: GenderKey, isOlder?: boolean): string {
  if (toGender === 'FEMALE') {
    return isOlder ? KINSHIP_TERMS.IN_LAW.BROTHER_OLDER_WIFE : KINSHIP_TERMS.IN_LAW.BROTHER_YOUNGER_WIFE;
  } else {
    return isOlder ? KINSHIP_TERMS.IN_LAW.SISTER_OLDER_HUSBAND : KINSHIP_TERMS.IN_LAW.SISTER_YOUNGER_HUSBAND;
  }
}

export function getSpouseSiblingTerm(fromGender: GenderKey, toGender: GenderKey, isOlder?: boolean): string {
  if (fromGender === 'MALE') {
    if (toGender === 'MALE') {
      return isOlder ? KINSHIP_TERMS.SPOUSE_SIBLING.WIFE_BROTHER_OLDER : KINSHIP_TERMS.SPOUSE_SIBLING.WIFE_BROTHER_YOUNGER;
    } else {
      return isOlder ? KINSHIP_TERMS.SPOUSE_SIBLING.WIFE_SISTER_OLDER : KINSHIP_TERMS.SPOUSE_SIBLING.WIFE_SISTER_YOUNGER;
    }
  } else if (fromGender === 'FEMALE') {
    if (toGender === 'MALE') {
      return isOlder ? KINSHIP_TERMS.SPOUSE_SIBLING.HUSBAND_BROTHER_OLDER : KINSHIP_TERMS.SPOUSE_SIBLING.HUSBAND_BROTHER_YOUNGER;
    } else {
      return isOlder ? KINSHIP_TERMS.SPOUSE_SIBLING.HUSBAND_SISTER_OLDER : KINSHIP_TERMS.SPOUSE_SIBLING.HUSBAND_SISTER_YOUNGER;
    }
  }
  return KINSHIP_TERMS.SPOUSE_SIBLING.SIBLINGS;
}

export function getSiblingsSpouseMutualTerm(fromGender: GenderKey, toGender: GenderKey): string {
  if (fromGender === 'MALE' && toGender === 'MALE') {
    return KINSHIP_TERMS.MUTUAL_IN_LAW.MALE_MALE;
  } else if (fromGender === 'FEMALE' && toGender === 'FEMALE') {
    return KINSHIP_TERMS.MUTUAL_IN_LAW.FEMALE_FEMALE;
  }
  return KINSHIP_TERMS.MUTUAL_IN_LAW.MIXED;
}

export function getRankPrefix(rank: number, total: number): string {
  if (rank === 1) return KINSHIP_TERMS.RANK.OLDEST;
  if (rank === total && total > 2) return KINSHIP_TERMS.RANK.YOUNGEST;

  const rankNames = ['', KINSHIP_TERMS.RANK.OLDEST, KINSHIP_TERMS.RANK.SECOND, KINSHIP_TERMS.RANK.THIRD, KINSHIP_TERMS.RANK.FOURTH, KINSHIP_TERMS.RANK.FIFTH, KINSHIP_TERMS.RANK.SIXTH, KINSHIP_TERMS.RANK.SEVENTH, KINSHIP_TERMS.RANK.EIGHTH, KINSHIP_TERMS.RANK.NINTH, KINSHIP_TERMS.RANK.TENTH];
  if (rank < rankNames.length) {
    return rankNames[rank];
  }

  return `${KINSHIP_TERMS.RANK.PREFIX}${rank}`;
}
