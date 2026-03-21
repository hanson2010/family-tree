/**
 * Extended kinship terms - only includes terms actually referenced in the codebase
 * Using uppercase English keys with Simplified Chinese values
 */
export const EXTENDED_KINSHIP_TERMS: Record<string, Record<string, string>> = {
  // Paternal side (father's relatives)
  PATERNAL: {
    'UNCLE_OLDER': '伯父',
    'UNCLE_YOUNGER': '叔父',
    'AUNT': '姑母',
    'AUNT_HUSBAND': '姑父',
    'GREAT_UNCLE_OLDER': '伯公',
    'GREAT_UNCLE_YOUNGER': '叔公',
    'GREAT_AUNT': '姑婆',
    'COUSIN_MALE': '堂兄弟',
    'COUSIN_FEMALE': '堂姐妹',
    'NEPHEW': '侄子',
    'NIECE': '侄女',
  },
  // Maternal side (mother's relatives)
  MATERNAL: {
    'UNCLE_WIFE': '舅母',
    'AUNT_HUSBAND': '姨父',
    'GREAT_UNCLE': '舅公',
    'GREAT_AUNT': '姨婆',
    'COUSIN_MALE': '表兄弟',
    'COUSIN_FEMALE': '表姐妹',
    'NEPHEW': '外甥',
    'NIECE': '外甥女',
  },
  // In-laws
  IN_LAW: {
    'SISTER_IN_LAW_SPOUSE': '姑嫂',
    'OLDER_BROTHER_WIFE': '嫂子',
    'YOUNGER_BROTHER_WIFE': '弟媳',
    'OLDER_SISTER_HUSBAND': '姐夫',
    'YOUNGER_SISTER_HUSBAND': '妹夫',
  },
  // Spouse's family
  SPOUSE_FAMILY: {
    'HUSBAND_FATHER': '公公',
    'HUSBAND_MOTHER': '婆婆',
    'WIFE_FATHER': '岳父',
    'WIFE_MOTHER': '岳母',
    'CHILD_IN_LAW_SON': '女婿',
    'CHILD_IN_LAW_DAUGHTER': '儿媳',
  },
  // Spouse's siblings (from speaker's perspective)
  SPOUSE_SIBLING: {
    'WIFE_OLDER_BROTHER': '内兄',
    'WIFE_YOUNGER_BROTHER': '内弟',
    'WIFE_OLDER_SISTER': '大姨子',
    'WIFE_YOUNGER_SISTER': '小姨子',
    'HUSBAND_OLDER_BROTHER': '大伯子',
    'HUSBAND_YOUNGER_BROTHER': '小叔子',
    'HUSBAND_OLDER_SISTER': '大姑子',
    'HUSBAND_YOUNGER_SISTER': '小姑子',
  },
  // Mutual in-law relationships
  MUTUAL_IN_LAW: {
    'MALE_MALE': '连襟',  // Husbands of sisters
    'FEMALE_FEMALE': '妯娌',   // Wives of brothers
  },
};
