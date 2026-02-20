import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(year?: number | null, month?: number | null, day?: number | null): string {
  if (!year && !month && !day) return '';

  const parts: string[] = [];
  if (year) parts.push(year.toString());
  if (month) parts.push(month.toString().padStart(2, '0'));
  if (day) parts.push(day.toString().padStart(2, '0'));

  return parts.join('/');
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function getGenderColor(gender: string, generation: number): string {
  const genKey = generation.toString() as '-2' | '-1' | '0' | '1' | '2' | '3';

  if (gender === 'MALE') {
    const maleColors: Record<string, string> = {
      '-2': '#1E40AF',
      '-1': '#1D4ED8',
      '0': '#2563EB',
      '1': '#3B82F6',
      '2': '#60A5FA',
      '3': '#93C5FD',
    };
    return maleColors[genKey] || '#2563EB';
  } else if (gender === 'FEMALE') {
    const femaleColors: Record<string, string> = {
      '-2': '#F59E0B',
      '-1': '#FBBF24',
      '0': '#FCD34D',
      '1': '#FDE68A',
      '2': '#FEF3C7',
      '3': '#FFFBEB',
    };
    return femaleColors[genKey] || '#FCD34D';
  }

  return '#9CA3AF'; // Gray for unknown
}
