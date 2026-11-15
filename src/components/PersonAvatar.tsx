import * as React from 'react';
import { cn } from '@/lib/utils';
import type { Person } from '@/types';
import { Gender } from '@/types';

interface PersonAvatarProps {
  person: Pick<Person, 'name' | 'gender' | 'avatar'>;
  className?: string;
}

const GENDER_STYLES: Record<Gender, string> = {
  [Gender.MALE]: 'bg-blue-600 text-white',
  [Gender.FEMALE]: 'bg-amber-300 text-stone-800',
  [Gender.UNKNOWN]: 'bg-stone-400 text-white',
};

/** Chinese names end with the given name, which tells family members apart better than the surname */
function initial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return /[㐀-鿿]/.test(trimmed) ? trimmed.slice(-1) : trimmed.slice(0, 1).toUpperCase();
}

/** Round avatar; falls back to one character of the name on the gender color */
export function PersonAvatar({ person, className }: PersonAvatarProps) {
  if (person.avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={person.avatar}
        alt={person.name}
        className={cn('h-8 w-8 shrink-0 rounded-full object-cover', className)}
      />
    );
  }

  return (
    <span
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
        GENDER_STYLES[person.gender] ?? GENDER_STYLES[Gender.UNKNOWN],
        className
      )}
    >
      {initial(person.name)}
    </span>
  );
}
