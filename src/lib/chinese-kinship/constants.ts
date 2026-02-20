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
    'BROTHER_IN_LAW': '姐夫/妹夫',
    'SISTER_IN_LAW': '嫂子/弟媳',
    'SISTER_IN_LAW_SPOUSE': '姑嫂',
    'BROTHERS_WIFE': '嫂子/弟媳',
    'BROTHERS_HUSBAND': '姐夫/妹夫',
    'SISTERS_HUSBAND': '姐夫/妹夫',
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
    'SPOUSE_FATHER': '岳父/公公',
    'SPOUSE_MOTHER': '岳母/婆婆',
    'SPOUSE_BROTHER': '大伯子/小叔子/内兄/内弟',
    'SPOUSE_SISTER': '大姑子/小姑子/大姨子/小姨子',
    'SPOUSE_UNCLE': '岳叔/岳伯',
    'SPOUSE_AUNT': '岳姑/岳姨',
  },
};
