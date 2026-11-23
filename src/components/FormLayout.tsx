'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/components/LocaleProvider';
import { cn } from '@/lib/utils';

/** Form fields in two columns: labels on the left (as wide as the longest), inputs on the right */
export function FormGrid({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5', className)}>{children}</div>
  );
}

/** A label in the left column of a FormGrid; `top` aligns it with the first line of a tall input */
export function RowLabel({ htmlFor, top, children }: { htmlFor?: string; top?: boolean; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor} className={cn('text-right', top && 'self-start pt-3')}>
      {children}
    </Label>
  );
}

/** Content under an input in a FormGrid, e.g. a hint: the right column only */
export function RowNote({ children }: { children: React.ReactNode }) {
  return <div className="col-start-2 -mt-1 space-y-1 text-sm text-muted-foreground">{children}</div>;
}

type Part = 'year' | 'month' | 'day';
const PARTS: { part: Part; min: number; max: number }[] = [
  { part: 'year', min: 0, max: 2100 },
  { part: 'month', min: 1, max: 12 },
  { part: 'day', min: 1, max: 31 },
];

/** Year, month and day inputs on one line; the first one gets `id`, for a RowLabel */
export function DateInputs({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: Record<Part, number | null | undefined>;
  onChange: (part: Part, value: number | null) => void;
  disabled?: boolean;
}) {
  const { t } = useLocale();
  return (
    <div className="grid grid-cols-[2fr_1fr_1fr] gap-2">
      {PARTS.map(({ part, min, max }) => (
        <Input
          key={part}
          id={part === 'year' ? id : undefined}
          type="number"
          aria-label={t(part)}
          placeholder={t(part)}
          value={value[part] || ''}
          onChange={(e) => onChange(part, e.target.value ? parseInt(e.target.value) : null)}
          min={min}
          max={max}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
