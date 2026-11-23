/**
 * A person's other names (别名, 小名, 曾用名, …; e.g. 香菱 for 甄英莲): full names other than the
 * name, 字 and 号, stored as a list sorted by pinyin.
 */

export const MAX_OTHER_NAMES = 20;
export const MAX_OTHER_NAME_LENGTH = 50;

const pinyin = new Intl.Collator('zh-CN-u-co-pinyin');

/** Separators accepted when other names are typed as one line */
const SEPARATORS = /[、,，;；/\n]+/;

/** Names trimmed, without blanks and repeats, sorted by pinyin */
export function normalizeOtherNames(names: readonly string[] | null | undefined): string[] {
  const clean = (names ?? []).map((n) => n.trim()).filter(Boolean);
  return [...new Set(clean)].sort(pinyin.compare);
}

/** Other names typed as one line, separated by 、 , ， ; ； / or new lines */
export function parseOtherNames(text: string): string[] {
  return normalizeOtherNames(text.split(SEPARATORS));
}

/** Other names for display and editing: 香菱、秋菱 */
export function formatOtherNames(names: readonly string[] | null | undefined): string {
  return (names ?? []).join('、');
}

/**
 * The other names of two persons merged into one named `name`: both lists, plus each person's
 * name when it is not the merged name, so no name the person went by is lost.
 */
export function mergeOtherNames(
  a: { name: string; otherNames?: string[] },
  b: { name: string; otherNames?: string[] },
  name: string
): string[] {
  const merged = normalizeOtherNames([...(a.otherNames ?? []), ...(b.otherNames ?? []), a.name, b.name]);
  return merged.filter((n) => n !== name.trim());
}
