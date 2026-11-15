'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/components/LocaleProvider';
import { cn } from '@/lib/utils';
import type { Gender, GenerationRange } from '@/types';
import { Gender as GenderEnum } from '@/types';
import { Minus, Plus } from 'lucide-react';

interface FilterControlsProps {
  genders: Gender[];
  livingInYear: number | null;
  generationRange: GenerationRange;
  onGendersChange: (genders: Gender[]) => void;
  onLivingInYearChange: (year: number | null) => void;
  onGenerationRangeChange: (range: GenerationRange) => void;
  onReset: () => void;
}

const MAX_GENERATIONS = 3;

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const buttonClass =
    'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-1 rounded-lg border bg-card p-0.5">
        <button
          type="button"
          className={buttonClass}
          onClick={() => onChange(value - 1)}
          disabled={value <= 0}
          aria-label={`${label} −`}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-5 text-center text-sm font-medium tabular-nums">{value}</span>
        <button
          type="button"
          className={buttonClass}
          onClick={() => onChange(value + 1)}
          disabled={value >= MAX_GENERATIONS}
          aria-label={`${label} +`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function FilterControls({
  genders,
  livingInYear,
  generationRange,
  onGendersChange,
  onLivingInYearChange,
  onGenerationRangeChange,
  onReset,
}: FilterControlsProps) {
  const { t } = useLocale();

  const GENDER_LABELS: Record<Gender, string> = {
    [GenderEnum.MALE]: t('male'),
    [GenderEnum.FEMALE]: t('female'),
    [GenderEnum.UNKNOWN]: t('unknown'),
  };

  const hasActiveFilters = genders.length > 0 || livingInYear !== null;

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      onLivingInYearChange(null);
    } else {
      const year = parseInt(value);
      if (!isNaN(year) && year >= 0 && year <= 2100) {
        onLivingInYearChange(year);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex h-5 items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('filters')}</h3>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="rounded text-xs font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('resetFilters')}
          </button>
        )}
      </div>

      {/* Gender */}
      <div className="space-y-2">
        <Label className="text-sm font-normal">{t('gender')}</Label>
        <div className="flex gap-1.5">
          {Object.entries(GENDER_LABELS).map(([value, label]) => {
            const isSelected = genders.includes(value as Gender);
            return (
              <button
                key={value}
                type="button"
                aria-pressed={isSelected}
                onClick={() =>
                  onGendersChange(isSelected ? genders.filter((g) => g !== value) : [...genders, value as Gender])
                }
                className={cn(
                  'h-8 flex-1 rounded-full border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-card text-foreground hover:bg-accent'
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Living in year */}
      <div className="space-y-2">
        <Label htmlFor="livingInYear" className="text-sm font-normal">
          {t('livingInYear')}
        </Label>
        <Input
          id="livingInYear"
          type="number"
          inputMode="numeric"
          placeholder={t('year')}
          value={livingInYear ?? ''}
          onChange={handleYearChange}
          min={0}
          max={2100}
          className="h-9 bg-card"
        />
      </div>

      {/* Generations shown around the selected person */}
      <div className="space-y-2">
        <Stepper
          label={t('ancestors')}
          value={generationRange.ancestors}
          onChange={(ancestors) => onGenerationRangeChange({ ...generationRange, ancestors })}
        />
        <Stepper
          label={t('descendants')}
          value={generationRange.descendants}
          onChange={(descendants) => onGenerationRangeChange({ ...generationRange, descendants })}
        />
      </div>
    </div>
  );
}
