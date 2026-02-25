/**
 * Extended kinship terms for complex relationships
 * Using uppercase English keys with Simplified Chinese values
 */
export const EXTENDED_KINSHIP_TERMS: Record<string, Record<string, string>> = {
  // Paternal side (father's relatives)
  PATERNAL: {
    'GRANDFATHER': '祖父',
    'GRANDMOTHER': '祖母',
    'GREAT_GRANDFATHER': '曾祖父',
    'GREAT_GRANDMOTHER': '曾祖母',
    'UNCLE_OLDER': '伯父',
    'UNCLE_YOUNGER': '叔父',
    'AUNT': '姑母',
    'AUNT_HUSBAND': '姑父',
    'COUSIN_MALE': '堂兄弟',
    'COUSIN_FEMALE': '堂姐妹',
    'NEPHEW': '侄子',
    'NIECE': '侄女',
  },
  // Maternal side (mother's relatives)
  MATERNAL: {
    'GRANDFATHER': '外祖父',
    'GRANDMOTHER': '外祖母',
    'UNCLE': '舅父',
    'AUNT': '姨母',
    'AUNT_HUSBAND': '姨父',
    'UNCLE_WIFE': '舅母',
    'COUSIN_MALE': '表兄弟',
    'COUSIN_FEMALE': '表姐妹',
    'NEPHEW': '外甥',
    'NIECE': '外甥女',
  },
  // In-laws (spouse's family)
  IN_LAW: {
    'FATHER_IN_LAW_MALE': '公公',
    'FATHER_IN_LAW_FEMALE': '岳父',
    'MOTHER_IN_LAW_MALE': '婆婆',
    'MOTHER_IN_LAW_FEMALE': '岳母',
    'SON_IN_LAW': '女婿',
    'DAUGHTER_IN_LAW': '儿媳',
    // Sibling's spouse (sister's husband)
    'OLDER_SISTER_HUSBAND': '姐夫',
    'YOUNGER_SISTER_HUSBAND': '妹夫',
    // Sibling's spouse (brother's wife)
    'OLDER_BROTHER_WIFE': '嫂子',
    'YOUNGER_BROTHER_WIFE': '弟媳',
    'SISTER_IN_LAW_SPOUSE': '姑嫂',
    // Spouse's siblings (from perspective of the speaker)
    'HUSBAND_OLDER_BROTHER': '大伯子',
    'HUSBAND_YOUNGER_BROTHER': '小叔子',
    'HUSBAND_OLDER_SISTER': '大姑子',
    'HUSBAND_YOUNGER_SISTER': '小姑子',
    'WIFE_OLDER_BROTHER': '内兄',
    'WIFE_YOUNGER_BROTHER': '内弟',
    'WIFE_OLDER_SISTER': '大姨子',
    'WIFE_YOUNGER_SISTER': '小姨子',
    // Mutual in-law relationships
    'LIANJIN': '连襟',  // Husbands of sisters
    'ZHOULI': '妯娌',   // Wives of brothers
  },
  // Spouse's family
  SPOUSE_FAMILY: {
    // Spouse's father (from speaker's perspective)
    'HUSBAND_FATHER': '公公',
    'WIFE_FATHER': '岳父',
    // Spouse's mother (from speaker's perspective)
    'HUSBAND_MOTHER': '婆婆',
    'WIFE_MOTHER': '岳母',
    // Spouse's brother (from speaker's perspective)
    'HUSBAND_OLDER_BROTHER': '大伯子',
    'HUSBAND_YOUNGER_BROTHER': '小叔子',
    'WIFE_OLDER_BROTHER': '内兄',
    'WIFE_YOUNGER_BROTHER': '内弟',
    // Spouse's sister (from speaker's perspective)
    'HUSBAND_OLDER_SISTER': '大姑子',
    'HUSBAND_YOUNGER_SISTER': '小姑子',
    'WIFE_OLDER_SISTER': '大姨子',
    'WIFE_YOUNGER_SISTER': '小姨子',
    // Spouse's uncles/aunts
    'HUSBAND_UNCLE_PATERNAL_OLDER': '伯父',
    'HUSBAND_UNCLE_PATERNAL_YOUNGER': '叔父',
    'HUSBAND_UNCLE_MATERNAL': '舅父',
    'WIFE_UNCLE_PATERNAL_OLDER': '岳伯',
    'WIFE_UNCLE_PATERNAL_YOUNGER': '岳叔',
    'WIFE_UNCLE_MATERNAL': '岳舅',
    'HUSBAND_AUNT_PATERNAL': '姑母',
    'HUSBAND_AUNT_MATERNAL': '姨母',
    'WIFE_AUNT_PATERNAL': '岳姑',
    'WIFE_AUNT_MATERNAL': '岳姨',
  },
};
