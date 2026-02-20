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

    // Messages
    authenticationRequired: '需要登录',
    pleaseSignIn: '请登录以执行此操作',
    error: '错误',
    failedToLoad: '加载失败',
    failedToSave: '保存失败',
    dataSeeded: '数据已生成',
    sampleDataAdded: '已添加示例贾家家谱数据',
    personCreated: '人物已创建',
    personUpdated: '人物已更新',
    relationshipCreated: '关系已创建',
    relationshipUpdated: '关系已更新',
    duplicatePerson: '人物已存在',
    personWithNameExists: '同名人物已存在，请确认是否为同一人',

    // Welcome
    welcome: '欢迎使用家谱系统',
    selectPerson: '选择一个人物开始浏览',
    noPersons: '暂无人物数据',
    signInToAdd: '登录后可新增人物',

    // Language
    language: '语言',
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

    // Messages
    authenticationRequired: 'Authentication required',
    pleaseSignIn: 'Please sign in to perform this action',
    error: 'Error',
    failedToLoad: 'Failed to load',
    failedToSave: 'Failed to save',
    dataSeeded: 'Data seeded',
    sampleDataAdded: 'Sample Jia family data has been added',
    personCreated: 'Person created',
    personUpdated: 'Person updated',
    relationshipCreated: 'Relationship created',
    relationshipUpdated: 'Relationship updated',
    duplicatePerson: 'Duplicate person detected',
    personWithNameExists: 'A person with this name already exists. Please confirm if this is the same person.',

    // Welcome
    welcome: 'Welcome to Family Tree',
    selectPerson: 'Select a person to start browsing',
    noPersons: 'No persons available',
    signInToAdd: 'Sign in to add persons',

    // Language
    language: 'Language',
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
