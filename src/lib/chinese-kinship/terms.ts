import type { Person } from '@/types';
import type { RelationshipPath, GenderKey } from './types';
import { getGenderKey } from './path-finder';
import { EXTENDED_KINSHIP_TERMS } from './constants';

/**
 * Get Chinese kinship term for parent-child relationship
 */
export function getParentChildTerm(
  fromGender: GenderKey,
  toGender: GenderKey,
  isParent: boolean
): string {
  if (isParent) {
    // From person is the parent, describing the child
    switch (toGender) {
      case 'MALE': return '儿子';
      case 'FEMALE': return '女儿';
      default: return '孩子';
    }
  } else {
    // From person is the child, describing the parent
    switch (toGender) {
      case 'MALE': return '父亲';
      case 'FEMALE': return '母亲';
      default: return '父母';
    }
  }
}

/**
 * Get Chinese kinship term for sibling relationship
 * Supports rank-based terms like 大哥, 二哥, 三哥, 大姐, 二姐, 小弟, 小妹, etc.
 */
export function getSiblingTerm(
  fromGender: GenderKey,
  toGender: GenderKey,
  isOlder?: boolean,
  siblingRank?: { rank: number; total: number }
): string {
  // Use rank-based terms if siblingRank is provided
  if (siblingRank && siblingRank.total > 1) {
    const prefix = getRankPrefix(siblingRank.rank, siblingRank.total);
    if (toGender === 'MALE') {
      // Older brother: 哥, Younger brother: 弟
      return `${prefix}${isOlder ? '哥' : '弟'}`;
    } else {
      // Older sister: 姐, Younger sister: 妹
      return `${prefix}${isOlder ? '姐' : '妹'}`;
    }
  }

  // Fallback to basic terms without rank
  if (fromGender === 'MALE') {
    // Male speaking
    switch (toGender) {
      case 'MALE':
        return isOlder ? '哥哥' : '弟弟';
      case 'FEMALE':
        return isOlder ? '姐姐' : '妹妹';
      default:
        return '兄弟姐妹';
    }
  } else if (fromGender === 'FEMALE') {
    // Female speaking
    switch (toGender) {
      case 'MALE':
        return isOlder ? '哥哥' : '弟弟';
      case 'FEMALE':
        return isOlder ? '姐姐' : '妹妹';
      default:
        return '兄弟姐妹';
    }
  }
  return '兄弟姐妹';
}

/**
 * Get Chinese kinship term for spouse relationship
 */
export function getSpouseTerm(
  fromGender: GenderKey,
  toGender: GenderKey
): string {
  if (fromGender === 'MALE' && toGender === 'FEMALE') {
    return '妻子';
  } else if (fromGender === 'FEMALE' && toGender === 'MALE') {
    return '丈夫';
  }
  return '配偶';
}

/**
 * Get Chinese kinship term for grandparent relationship
 */
export function getGrandparentTerm(
  toGender: GenderKey,
  isGrandparent: boolean,
  generationDiff: number
): string {
  if (isGrandparent) {
    // From person is the grandchild
    if (generationDiff === 2) {
      return toGender === 'MALE' ? '祖父' : '祖母';
    } else if (generationDiff === -2) {
      return toGender === 'MALE' ? '孙子' : '孙女';
    }
  }
  return toGender === 'MALE' ? '祖父' : '祖母';
}

/**
 * Get Chinese kinship term for aunt/uncle relationship
 * Supports rank-based terms like 大姑, 二姑, 三姑, 大姨, 二姨, 三姨, etc.
 */
export function getAuntUncleTerm(
  fromGender: GenderKey,
  toGender: GenderKey,
  side: 'PATERNAL' | 'MATERNAL',
  isOlder?: boolean,
  siblingRank?: { rank: number; total: number }
): string {
  if (side === 'PATERNAL') {
    // Father's side
    if (toGender === 'MALE') {
      // 伯父 = older than father, 叔父 = younger than father
      return isOlder ? '伯父' : '叔叔';
    } else {
      // Father's sisters: 大姑, 二姑, 三姑, etc.
      if (siblingRank && siblingRank.total > 1) {
        const prefix = getRankPrefix(siblingRank.rank, siblingRank.total);
        return `${prefix}姑`;
      }
      return '姑母';
    }
  } else {
    // Mother's side
    if (toGender === 'MALE') {
      // Mother's brothers: 大舅, 二舅, 三舅, etc.
      if (siblingRank && siblingRank.total > 1) {
        const prefix = getRankPrefix(siblingRank.rank, siblingRank.total);
        return `${prefix}舅`;
      }
      return '舅父';
    } else {
      // Mother's sisters: 大姨, 二姨, 三姨, etc.
      if (siblingRank && siblingRank.total > 1) {
        const prefix = getRankPrefix(siblingRank.rank, siblingRank.total);
        return `${prefix}姨`;
      }
      return '姨母';
    }
  }
}

/**
 * Get Chinese kinship term for nephew/niece relationship
 */
export function getNephewNieceTerm(
  toGender: GenderKey,
  fromGender: GenderKey
): string {
  if (fromGender === 'MALE') {
    // From uncle/aunt (male perspective - speaking of sibling's child)
    return toGender === 'MALE' ? EXTENDED_KINSHIP_TERMS.PATERNAL.NEPHEW : EXTENDED_KINSHIP_TERMS.PATERNAL.NIECE;
  } else {
    // From aunt (female perspective)
    return toGender === 'MALE' ? EXTENDED_KINSHIP_TERMS.MATERNAL.NEPHEW : EXTENDED_KINSHIP_TERMS.MATERNAL.NIECE;
  }
}

/**
 * Get Chinese kinship term for cousin relationship
 */
export function getCousinTerm(
  fromGender: GenderKey,
  toGender: GenderKey,
  side: 'PATERNAL' | 'MATERNAL',
  isOlder?: boolean
): string {
  if (side === 'PATERNAL') {
    // Same surname cousins
    return toGender === 'MALE' ? EXTENDED_KINSHIP_TERMS.PATERNAL.COUSIN_MALE : EXTENDED_KINSHIP_TERMS.PATERNAL.COUSIN_FEMALE;
  } else {
    // Different surname cousins
    return toGender === 'MALE' ? EXTENDED_KINSHIP_TERMS.MATERNAL.COUSIN_MALE : EXTENDED_KINSHIP_TERMS.MATERNAL.COUSIN_FEMALE;
  }
}

/**
 * Get Chinese kinship term for in-law relationships
 */
export function getInLawTerm(
  fromGender: GenderKey,
  toGender: GenderKey,
  relationshipType: string,
  isOlder?: boolean
): string {
  // Spouse's relatives
  if (relationshipType === 'SPOUSE_PARENT') {
    // Use differentiated terms based on speaker's gender
    if (fromGender === 'MALE') {
      // Male speaker: wife's parent
      return toGender === 'MALE' ? EXTENDED_KINSHIP_TERMS.SPOUSE_FAMILY.WIFE_FATHER : EXTENDED_KINSHIP_TERMS.SPOUSE_FAMILY.WIFE_MOTHER;
    } else {
      // Female speaker: husband's parent
      return toGender === 'MALE' ? EXTENDED_KINSHIP_TERMS.SPOUSE_FAMILY.HUSBAND_FATHER : EXTENDED_KINSHIP_TERMS.SPOUSE_FAMILY.HUSBAND_MOTHER;
    }
  }

  // Sibling's spouse - use differentiated terms
  if (toGender === 'FEMALE') {
    // Sibling's wife
    return isOlder ? EXTENDED_KINSHIP_TERMS.IN_LAW.OLDER_BROTHER_WIFE : EXTENDED_KINSHIP_TERMS.IN_LAW.YOUNGER_BROTHER_WIFE;
  } else {
    // Sibling's husband
    return isOlder ? EXTENDED_KINSHIP_TERMS.IN_LAW.OLDER_SISTER_HUSBAND : EXTENDED_KINSHIP_TERMS.IN_LAW.YOUNGER_SISTER_HUSBAND;
  }
}

/**
 * Get rank-based prefix for Chinese kinship terms
 * 大 = oldest, 二 = second, 三 = third, etc., 老 = youngest
 */
function getRankPrefix(rank: number, total: number): string {
  if (rank === 1) return '大';
  if (rank === total && total > 2) return '老';

  const rankNames = ['', '大', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  if (rank < rankNames.length) {
    return rankNames[rank];
  }

  // For ranks beyond 10, use Chinese numerals
  return `第${rank}`;
}

/**
 * Comprehensive Chinese kinship term lookup
 * Based on relationship path and gender context
 */
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
  const { relationshipType, generations } = path;
  // Use path.side and path.isOlder if available, otherwise fall back to additionalContext
  const side = path.side ?? additionalContext?.side;
  const isOlder = path.isOlder ?? additionalContext?.isOlder;
  const siblingRank = additionalContext?.siblingRank;

  switch (relationshipType) {
    case 'PARENT':
      return getParentChildTerm(fromGender, toGender, true);

    case 'CHILD':
      return getParentChildTerm(fromGender, toGender, false);

    case 'SIBLING':
      return getSiblingTerm(fromGender, toGender, isOlder, siblingRank);

    case 'HALF_SIBLING':
      return toGender === 'MALE' ? '同父异母兄弟' : '同父异母姐妹';

    case 'SPOUSE':
      return getSpouseTerm(fromGender, toGender);

    case 'CONCUBINE':
      return fromGender === 'MALE' ? '妾' : '夫君';

    case 'BETROTHED':
      return fromGender === 'MALE' ? '未婚妻' : '未婚夫';

    case 'ADOPTIVE_PARENT':
      return toGender === 'MALE' ? '养父' : '养母';

    case 'ADOPTED_CHILD':
      return toGender === 'MALE' ? '养子' : '养女';

    case 'FOSTER_PARENT':
      return toGender === 'MALE' ? '寄父' : '寄母';

    case 'FOSTER_CHILD':
      return toGender === 'MALE' ? '义子' : '义女';

    case 'STEPPARENT':
      // Parent's spouse (not biological parent)
      return toGender === 'MALE' ? '继父' : '继母';

    case 'STEPCHILD':
      // Spouse's child (not biological child)
      // In Chinese culture, step-children are often just called 儿子/女儿
      return toGender === 'MALE' ? '儿子' : '女儿';

    case 'SWORN_SIBLING':
      return toGender === 'MALE' ? '结拜兄弟' : '结拜姐妹';

    case 'GRANDPARENT':
      return toGender === 'MALE' ? '祖父' : '祖母';

    case 'GRANDCHILD':
      return toGender === 'MALE' ? '孙子' : '孙女';

    case 'GREAT_GRANDPARENT':
      return toGender === 'MALE' ? '曾祖父' : '曾祖母';

    case 'GREAT_GRANDCHILD':
      return toGender === 'MALE' ? '曾孙' : '曾孙女';

    case 'AUNT_UNCLE':
      if (side) {
        return getAuntUncleTerm(fromGender, toGender, side, isOlder, siblingRank);
      }
      // Without side info, use constants for differentiated terms
      if (toGender === 'MALE') {
        return isOlder ? EXTENDED_KINSHIP_TERMS.PATERNAL.UNCLE_OLDER : EXTENDED_KINSHIP_TERMS.PATERNAL.UNCLE_YOUNGER;
      } else {
        return EXTENDED_KINSHIP_TERMS.PATERNAL.AUNT;
      }

    case 'AUNT_UNCLE_SPOUSE':
      // Spouse of aunt/uncle (uncle's wife or aunt's husband)
      if (side === 'PATERNAL') {
        // Father's side
        if (toGender === 'FEMALE') {
          // Uncle's wife: 伯母 (older uncle's wife) or 婶娘 (younger uncle's wife)
          return isOlder ? '伯母' : '婶娘';
        } else {
          // Aunt's husband: 姑父
          return EXTENDED_KINSHIP_TERMS.PATERNAL.AUNT_HUSBAND;
        }
      } else if (side === 'MATERNAL') {
        // Mother's side
        if (toGender === 'FEMALE') {
          // Uncle's wife: 舅母
          return EXTENDED_KINSHIP_TERMS.MATERNAL.UNCLE_WIFE;
        } else {
          // Aunt's husband: 姨父
          return EXTENDED_KINSHIP_TERMS.MATERNAL.AUNT_HUSBAND;
        }
      }
      // Fallback without side info
      if (toGender === 'FEMALE') {
        return isOlder ? '伯母' : '婶娘';
      } else {
        return '姑父';
      }

    case 'GREAT_AUNT_UNCLE':
      // Grandparent's sibling: 伯公/叔公/舅公/姑婆/姨婆
      if (side === 'PATERNAL') {
        return toGender === 'MALE'
          ? (isOlder ? EXTENDED_KINSHIP_TERMS.PATERNAL.GREAT_UNCLE_OLDER : EXTENDED_KINSHIP_TERMS.PATERNAL.GREAT_UNCLE_YOUNGER)
          : EXTENDED_KINSHIP_TERMS.PATERNAL.GREAT_AUNT;
      } else if (side === 'MATERNAL') {
        return toGender === 'MALE' ? EXTENDED_KINSHIP_TERMS.MATERNAL.GREAT_UNCLE : EXTENDED_KINSHIP_TERMS.MATERNAL.GREAT_AUNT;
      }
      // Fallback without side info - use differentiated terms
      if (toGender === 'MALE') {
        return isOlder ? EXTENDED_KINSHIP_TERMS.PATERNAL.GREAT_UNCLE_OLDER : EXTENDED_KINSHIP_TERMS.PATERNAL.GREAT_UNCLE_YOUNGER;
      } else {
        return EXTENDED_KINSHIP_TERMS.PATERNAL.GREAT_AUNT;
      }

    case 'GREAT_GREAT_AUNT_UNCLE':
      // Great grandparent's sibling: 太伯公/太叔公/太舅公/太姑婆/太姨婆
      if (side === 'PATERNAL') {
        return toGender === 'MALE'
          ? (isOlder ? '太伯公' : '太叔公')
          : '太姑婆';
      } else if (side === 'MATERNAL') {
        return toGender === 'MALE' ? '太舅公' : '太姨婆';
      }
      // Fallback without side info - use differentiated terms
      if (toGender === 'MALE') {
        return isOlder ? '太伯公' : '太叔公';
      } else {
        return '太姑婆';
      }

    case 'NEPHEW_NIECE':
      return getNephewNieceTerm(toGender, fromGender);

    case 'GREAT_NEPHEW_NIECE':
      // Sibling's grandchild: 侄孙/侄孙女/外甥孙/外甥孙女
      if (fromGender === 'MALE') {
        return toGender === 'MALE' ? '侄孙' : '侄孙女';
      } else {
        return toGender === 'MALE' ? '外甥孙' : '外甥孙女';
      }

    case 'GREAT_GREAT_NEPHEW_NIECE':
      // Sibling's great-grandchild: 侄曾孙/侄曾孙女/外甥曾孙/外甥曾孙女
      if (fromGender === 'MALE') {
        return toGender === 'MALE' ? '侄曾孙' : '侄曾孙女';
      } else {
        return toGender === 'MALE' ? '外甥曾孙' : '外甥曾孙女';
      }

    case 'COUSIN':
      if (side) {
        return getCousinTerm(fromGender, toGender, side, isOlder);
      }
      // Without side info, we cannot determine 堂 vs 表
      // Use a generic term since we don't know if it's paternal or maternal
      return toGender === 'MALE' ? '堂兄弟/表兄弟' : '堂姐妹/表姐妹';

    case 'PARENT_IN_LAW':
      // Use differentiated terms based on speaker's gender
      if (fromGender === 'MALE') {
        // Male speaker: wife's parent
        return toGender === 'MALE' ? EXTENDED_KINSHIP_TERMS.SPOUSE_FAMILY.WIFE_FATHER : EXTENDED_KINSHIP_TERMS.SPOUSE_FAMILY.WIFE_MOTHER;
      } else {
        // Female speaker: husband's parent
        return toGender === 'MALE' ? EXTENDED_KINSHIP_TERMS.SPOUSE_FAMILY.HUSBAND_FATHER : EXTENDED_KINSHIP_TERMS.SPOUSE_FAMILY.HUSBAND_MOTHER;
      }

    case 'CHILD_IN_LAW':
      return toGender === 'MALE' ? EXTENDED_KINSHIP_TERMS.SPOUSE_FAMILY.CHILD_IN_LAW_SON : EXTENDED_KINSHIP_TERMS.SPOUSE_FAMILY.CHILD_IN_LAW_DAUGHTER;

    case 'SIBLING_IN_LAW':
      // Sibling's spouse - determine based on whether sibling is older or younger
      // isOlder = true means the intermediate sibling is older than fromPerson
      if (toGender === 'FEMALE') {
        // Sibling's wife
        return isOlder ? EXTENDED_KINSHIP_TERMS.IN_LAW.OLDER_BROTHER_WIFE : EXTENDED_KINSHIP_TERMS.IN_LAW.YOUNGER_BROTHER_WIFE;
      } else {
        // Sibling's husband
        return isOlder ? EXTENDED_KINSHIP_TERMS.IN_LAW.OLDER_SISTER_HUSBAND : EXTENDED_KINSHIP_TERMS.IN_LAW.YOUNGER_SISTER_HUSBAND;
      }

    case 'SPOUSE_SIBLING':
      // Spouse's sibling - 大叔子/小叔子/大姨子/小姨子
      // isOlder = true means the spouse's sibling is older than the spouse
      if (fromGender === 'MALE') {
        // Male speaking about spouse's sibling
        if (toGender === 'MALE') {
          // Wife's brother: 内兄 (older) / 内弟 (younger)
          return isOlder ? EXTENDED_KINSHIP_TERMS.SPOUSE_SIBLING.WIFE_OLDER_BROTHER : EXTENDED_KINSHIP_TERMS.SPOUSE_SIBLING.WIFE_YOUNGER_BROTHER;
        } else {
          // Wife's sister: 大姨子 (older) / 小姨子 (younger)
          return isOlder ? EXTENDED_KINSHIP_TERMS.SPOUSE_SIBLING.WIFE_OLDER_SISTER : EXTENDED_KINSHIP_TERMS.SPOUSE_SIBLING.WIFE_YOUNGER_SISTER;
        }
      } else if (fromGender === 'FEMALE') {
        // Female speaking about spouse's sibling
        if (toGender === 'MALE') {
          // Husband's brother: 大伯子 (older) / 小叔子 (younger)
          return isOlder ? EXTENDED_KINSHIP_TERMS.SPOUSE_SIBLING.HUSBAND_OLDER_BROTHER : EXTENDED_KINSHIP_TERMS.SPOUSE_SIBLING.HUSBAND_YOUNGER_BROTHER;
        } else {
          // Husband's sister: 大姑子 (older) / 小姑子 (younger)
          return isOlder ? EXTENDED_KINSHIP_TERMS.SPOUSE_SIBLING.HUSBAND_OLDER_SISTER : EXTENDED_KINSHIP_TERMS.SPOUSE_SIBLING.HUSBAND_YOUNGER_SISTER;
        }
      }
      return '配偶的兄弟姐妹';

    case 'SIBLINGS_SPOUSE_MUTUAL':
      // Relationship between spouses of siblings
      // 连襟: husbands of sisters (sisters' husbands related to each other)
      // 妯娌: wives of brothers (brothers' wives related to each other)
      if (fromGender === 'MALE' && toGender === 'MALE') {
        // Both are men - they are 连襟 (husbands of sisters)
        return EXTENDED_KINSHIP_TERMS.MUTUAL_IN_LAW.MALE_MALE;
      } else if (fromGender === 'FEMALE' && toGender === 'FEMALE') {
        // Both are women - they are 妯娌 (wives of brothers)
        return EXTENDED_KINSHIP_TERMS.MUTUAL_IN_LAW.FEMALE_FEMALE;
      }
      // Mixed gender - not a traditional term
      return '兄弟姐妹的配偶';

    case 'SISTER_IN_LAW_SPOUSE':
      return EXTENDED_KINSHIP_TERMS.IN_LAW.SISTER_IN_LAW_SPOUSE;

    case 'BROTHERS_WIFE':
      // Brother's wife - use differentiated terms based on age
      return isOlder ? EXTENDED_KINSHIP_TERMS.IN_LAW.OLDER_BROTHER_WIFE : EXTENDED_KINSHIP_TERMS.IN_LAW.YOUNGER_BROTHER_WIFE;

    case 'BROTHERS_HUSBAND':
      // Sister's husband - use differentiated terms based on age
      return isOlder ? EXTENDED_KINSHIP_TERMS.IN_LAW.OLDER_SISTER_HUSBAND : EXTENDED_KINSHIP_TERMS.IN_LAW.YOUNGER_SISTER_HUSBAND;

    case 'SISTERS_HUSBAND':
      // Sister's husband - use differentiated terms based on age
      return isOlder ? EXTENDED_KINSHIP_TERMS.IN_LAW.OLDER_SISTER_HUSBAND : EXTENDED_KINSHIP_TERMS.IN_LAW.YOUNGER_SISTER_HUSBAND;

    case 'GREAT_GREAT_GRANDPARENT':
      return toGender === 'MALE' ? '高祖父' : '高祖母';

    case 'GREAT_GREAT_GRANDCHILD':
      return toGender === 'MALE' ? '玄孙' : '玄孙女';

    default:
      // Handle dynamic relationship types like GRANDPARENT_4, GRANDCHILD_4, etc.
      if (relationshipType.startsWith('GRANDPARENT_')) {
        const gen = parseInt(relationshipType.split('_')[1]) || 2;
        if (gen === 2) return toGender === 'MALE' ? '祖父' : '祖母';
        if (gen === 3) return toGender === 'MALE' ? '曾祖父' : '曾祖母';
        if (gen === 4) return toGender === 'MALE' ? '高祖父' : '高祖母';
        return toGender === 'MALE' ? `第${gen}代祖父` : `第${gen}代祖母`;
      }
      if (relationshipType.startsWith('GRANDCHILD_')) {
        const gen = parseInt(relationshipType.split('_')[1]) || 2;
        if (gen === 2) return toGender === 'MALE' ? '孙子' : '孙女';
        if (gen === 3) return toGender === 'MALE' ? '曾孙' : '曾孙女';
        if (gen === 4) return toGender === 'MALE' ? '玄孙' : '玄孙女';
        return toGender === 'MALE' ? `第${gen}代孙` : `第${gen}代孙女`;
      }
      // For truly unknown relationships, return a generic term
      if (relationshipType === '亲属') {
        return '亲属';
      }
      return relationshipType;
  }
}
