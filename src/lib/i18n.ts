// Internationalization system for Family Tree application
// Supports Chinese (Simplified) and English

export type Locale = 'zh' | 'en';

export const defaultLocale: Locale = 'zh';

export const locales: Locale[] = ['zh', 'en'];

export const localeNames: Record<Locale, string> = {
  zh: '简体中文',
  en: 'English',
};

export const translations = {
  zh: {
    // Header
    appName: '家谱',
    signIn: '登录',
    signOut: '登出',
    signInWithGitHub: '使用 GitHub 登录',

    // Navigation
    menu: '菜单',
    addPerson: '新增人物',
    addRelationship: '新增关系',
    refresh: '随机选择人物',
    seedData: '生成示例数据',
    clearSelection: '清除选择',

    // Filters
    filters: '筛选条件',
    gender: '性别',
    male: '男',
    female: '女',
    unknown: '未知',
    searchByName: '按姓名搜索',
    showPrivate: '显示私人人物',
    resetFilters: '重置筛选',
    livingInYear: '在世年份',

    // Generation range
    generationRange: '世代范围',
    ancestors: '祖先世代',
    descendants: '后代世代',

    // Person form
    personInfo: '人物信息',
    name: '姓名',
    courtesyName: '字',
    artName: '号',
    birthDate: '出生日期',
    deathDate: '逝世日期',
    year: '年',
    month: '月',
    day: '日',
    avatar: '头像',
    isPrivate: '设为私人',
    save: '保存',
    cancel: '取消',
    edit: '编辑',
    delete: '删除',
    createPerson: '新增人物',
    editPerson: '编辑人物',

    // Relationship form
    relationshipInfo: '关系信息',
    relationshipType: '关系类型',
    parentChild: '父母-子女',
    sibling: '兄弟姐妹',
    halfSibling: '同父异母/同母异父兄弟姐妹',
    spouse: '配偶',
    concubine: '妾',
    betrothed: '未婚妻/夫',
    adoptiveParent: '养父母',
    fosterParent: '寄养父母',
    swornSibling: '结拜兄弟姐妹',
    personA: '人物 A',
    personB: '人物 B',
    startDate: '开始日期',
    endDate: '结束日期',
    createRelationship: '新增关系',
    editRelationship: '编辑关系',

    // Quick relationship form
    quickAddRelationship: '新增三口关系',
    quickAddRelationshipTitle: '新增三口关系',
    quickAddRelationshipDesc: '选择父亲、母亲和子女，系统将自动创建婚姻关系和父母子女关系。',
    father: '父亲（男）',
    mother: '母亲（女）',
    child: '子女',
    marriageDate: '婚姻日期（可选）',
    marriageDateOptional: '婚姻日期（可选）',

    // Change relationship form
    changeRelationship: '修改或删除关系',
    selectPerson: '选择人物',
    personRelationships: '该人物的关系',
    noRelationships: '该人物没有任何关系',
    editRelationshipDates: '编辑关系日期',
    updateDates: '更新日期',
    deleteRelationship: '删除关系',
    relationshipCreated: '关系已创建',
    relationshipDeleted: '关系已删除',
    relationshipUpdated: '关系已更新',
    saving: '保存中...',
    deleting: '删除中...',
    updating: '更新中...',
    close: '关闭',
    isParentOf: '是 {name} 的父母',
    isChildOf: '是 {name} 的子女',
    spouseWith: '与 {name} 是配偶',
    relationshipWith: '与 {name}: {type}',

    // Validation errors
    validationError: '验证错误',
    mustSelectTwoPersons: '必须选择两个人',
    cannotCreateRelationshipWithSelf: '不能为同一个人创建关系',
    mustSelectParents: '选择子女时，必须选择至少一位父母',
    duplicatePersonSelection: '不能选择重复的人物',

    // Messages
    authenticationRequired: '需要登录',
    pleaseSignIn: '请登录以执行此操作',
    error: '错误',
    failedToLoad: '加载失败',
    failedToSave: '保存失败',
    failedToDeleteRelationship: '删除关系失败',
    failedToUpdateRelationship: '更新关系失败',
    dataSeeded: '数据已生成',
    sampleDataAdded: '已添加示例贾家家谱数据',
    personCreated: '人物已创建',
    personUpdated: '人物已更新',
    duplicatePerson: '人物已存在',
    personWithNameExists: '同名人物已存在，请确认是否为同一人',

    // Welcome
    welcome: '欢迎使用家谱系统',
    noPersons: '暂无人物数据',
    signInToAdd: '登录后可新增人物',

    // Language
    language: '语言',
    switchToChinese: '中文',
    switchLanguage: 'English',
    toggleLanguage: 'English',
  },
  en: {
    // Header
    appName: 'Family Tree',
    signIn: 'Sign In',
    signOut: 'Sign Out',
    signInWithGitHub: 'Sign in with GitHub',

    // Navigation
    menu: 'Menu',
    addPerson: 'Add Person',
    addRelationship: 'Add Relationship',
    refresh: 'Select Random Person',
    seedData: 'Seed Sample Data',
    clearSelection: 'Clear Selection',

    // Filters
    filters: 'Filters',
    gender: 'Gender',
    male: 'Male',
    female: 'Female',
    unknown: 'Unknown',
    searchByName: 'Search by name',
    showPrivate: 'Show private persons',
    resetFilters: 'Reset Filters',
    livingInYear: 'Living in year',

    // Generation range
    generationRange: 'Generation Range',
    ancestors: 'Ancestor generations',
    descendants: 'Descendant generations',

    // Person form
    personInfo: 'Person Information',
    name: 'Name',
    courtesyName: 'Courtesy Name',
    artName: 'Art Name',
    birthDate: 'Birth Date',
    deathDate: 'Death Date',
    year: 'Year',
    month: 'Month',
    day: 'Day',
    avatar: 'Avatar',
    isPrivate: 'Mark as private',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    createPerson: 'Create Person',
    editPerson: 'Edit Person',

    // Relationship form
    relationshipInfo: 'Relationship Information',
    relationshipType: 'Relationship Type',
    parentChild: 'Parent-Child',
    sibling: 'Sibling',
    halfSibling: 'Half-Sibling',
    spouse: 'Spouse',
    concubine: 'Concubine',
    betrothed: 'Betrothed',
    adoptiveParent: 'Adoptive Parent',
    fosterParent: 'Foster Parent',
    swornSibling: 'Sworn Sibling',
    personA: 'Person A',
    personB: 'Person B',
    startDate: 'Start Date',
    endDate: 'End Date',
    createRelationship: 'Create Relationship',
    editRelationship: 'Edit Relationship',

    // Quick relationship form
    quickAddRelationship: 'Add Family Relationships',
    quickAddRelationshipTitle: 'Add Family Relationships',
    quickAddRelationshipDesc: 'Select father, mother and child. The system will automatically create marriage and parent-child relationships.',
    father: 'Father (Male)',
    mother: 'Mother (Female)',
    child: 'Child',
    marriageDate: 'Marriage Date (Optional)',
    marriageDateOptional: 'Marriage Date (Optional)',

    // Change relationship form
    changeRelationship: 'Modify or Delete Relationship',
    selectPerson: 'Select Person',
    personRelationships: 'Person\'s Relationships',
    noRelationships: 'This person has no relationships',
    editRelationshipDates: 'Edit Relationship Dates',
    updateDates: 'Update Dates',
    deleteRelationship: 'Delete Relationship',
    relationshipCreated: 'Relationship created',
    relationshipDeleted: 'Relationship deleted',
    relationshipUpdated: 'Relationship updated',
    saving: 'Saving...',
    deleting: 'Deleting...',
    updating: 'Updating...',
    close: 'Close',
    isParentOf: 'is parent of {name}',
    isChildOf: 'is child of {name}',
    spouseWith: 'is spouse with {name}',
    relationshipWith: 'with {name}: {type}',

    // Validation errors
    validationError: 'Validation Error',
    mustSelectTwoPersons: 'Must select two persons',
    cannotCreateRelationshipWithSelf: 'Cannot create relationship with the same person',
    mustSelectParents: 'When selecting a child, at least one parent must be selected',
    duplicatePersonSelection: 'Cannot select duplicate persons',

    // Messages
    authenticationRequired: 'Authentication required',
    pleaseSignIn: 'Please sign in to perform this action',
    error: 'Error',
    failedToLoad: 'Failed to load',
    failedToSave: 'Failed to save',
    failedToDeleteRelationship: 'Failed to delete relationship',
    failedToUpdateRelationship: 'Failed to update relationship',
    dataSeeded: 'Data seeded',
    sampleDataAdded: 'Sample Jia family data has been added',
    personCreated: 'Person created',
    personUpdated: 'Person updated',
    duplicatePerson: 'Duplicate person detected',
    personWithNameExists: 'A person with this name already exists. Please confirm if this is the same person.',

    // Welcome
    welcome: 'Welcome to Family Tree',
    noPersons: 'No persons available',
    signInToAdd: 'Sign in to add persons',

    // Language
    language: 'Language',
    switchToChinese: '中文',
    switchLanguage: '中文',
    toggleLanguage: '中文',
  },
} as const;

export type TranslationKey = keyof typeof translations.zh;

export function t(locale: Locale, key: TranslationKey): string {
  return translations[locale][key] || translations.en[key] || key;
}

// Client-side locale management
export function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return defaultLocale;

  const stored = localStorage.getItem('locale');
  if (stored && locales.includes(stored as Locale)) {
    return stored as Locale;
  }
  return defaultLocale;
}

export function setStoredLocale(locale: Locale): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('locale', locale);
}
