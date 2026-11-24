import type { Person } from '@/types';

/**
 * 生肖 from a birth date. The animal changes at 春节 (between 21 January and 20 February), so:
 * - a year alone gives that year's animal, as Chinese records give the birth year as the lunar
 *   year;
 * - a full date is converted to the Chinese calendar;
 * - a month from March on gives the year's animal; January or February without a day gives one
 *   only when 春节 does not fall inside that month.
 */

const ANIMALS_ZH = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
const ANIMALS_EN = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'];
const ANIMAL_EMOJI = ['🐭', '🐮', '🐯', '🐰', '🐲', '🐍', '🐴', '🐑', '🐵', '🐔', '🐶', '🐷'];

let chineseCalendar: Intl.DateTimeFormat | null | undefined;

/** The Gregorian year in which the Chinese year holding this date began, or null if unavailable */
function lunarYearOf(year: number, month: number, day: number): number | null {
  if (chineseCalendar === undefined) {
    try {
      chineseCalendar = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { year: 'numeric', timeZone: 'UTC' });
    } catch {
      chineseCalendar = null;
    }
  }
  if (!chineseCalendar) return null;
  const date = new Date(Date.UTC(2000, month - 1, day, 12));
  date.setUTCFullYear(year);
  const related = chineseCalendar.formatToParts(date).find((part) => (part.type as string) === 'relatedYear');
  const value = related ? Number(related.value) : NaN;
  return Number.isFinite(value) ? value : null;
}

/** The year whose animal is the person's 生肖, or null when the birth date does not settle it */
export function zodiacYear(p: Pick<Person, 'birthYear' | 'birthMonth' | 'birthDay'>): number | null {
  const { birthYear: year, birthMonth: month, birthDay: day } = p;
  if (year == null) return null;
  if (month == null || month >= 3) return year;
  if (day != null) {
    return lunarYearOf(year, month, day) ?? (month === 1 && day < 21 ? year - 1 : month === 2 && day > 20 ? year : null);
  }
  const lastDay = new Date(Date.UTC(2001, month, 0)).getUTCDate() + (month === 2 && isLeap(year) ? 1 : 0);
  const first = lunarYearOf(year, month, 1);
  const last = lunarYearOf(year, month, lastDay);
  return first != null && first === last ? first : null;
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** The person's 生肖 (鼠 … 猪, or Rat … Pig in English), or null when it cannot be told */
export function zodiacAnimal(p: Pick<Person, 'birthYear' | 'birthMonth' | 'birthDay'>, locale: string): string | null {
  const year = zodiacYear(p);
  if (year == null) return null;
  const index = (((year - 4) % 12) + 12) % 12;
  return (locale === 'zh' ? ANIMALS_ZH : ANIMALS_EN)[index];
}

/** The emoji of the person's 生肖 (faces where Unicode has them; 🐑 for 羊), or null */
export function zodiacEmoji(p: Pick<Person, 'birthYear' | 'birthMonth' | 'birthDay'>): string | null {
  const year = zodiacYear(p);
  return year == null ? null : ANIMAL_EMOJI[(((year - 4) % 12) + 12) % 12];
}
