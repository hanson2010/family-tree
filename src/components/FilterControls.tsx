'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/components/LocaleProvider';
import { cn } from '@/lib/utils';
import type { Gender, GenerationRange } from '@/types';
import { Gender as GenderEnum } from '@/types';
import { Minus, Plus } from 'lucide-react';

/** Size and corners shared by the year box and the generation steppers, so they line up */
const CONTROL_BOX = 'h-9 w-28 rounded-lg';

/** Years accepted by the living-in-year filter */
const MIN_YEAR = 0;
const MAX_YEAR = 2100;

/** The − and + buttons of a stepper */
const STEP_BUTTON =
  'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

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

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <div className={cn(CONTROL_BOX, 'flex items-center justify-between border bg-card p-0.5')}>
        <button
          type="button"
          className={STEP_BUTTON}
          onClick={() => onChange(value - 1)}
          disabled={value <= 0}
          aria-label={`${label} −`}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-5 text-center text-sm font-medium tabular-nums">{value}</span>
        <button
          type="button"
          className={STEP_BUTTON}
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
    const value = e.target.value.trim();
    if (value === '') {
      onLivingInYearChange(null);
    } else if (/^\d+$/.test(value)) {
      const year = parseInt(value, 10);
      if (year >= MIN_YEAR && year <= MAX_YEAR) onLivingInYearChange(year);
    }
  };

  // − and +: the first press sets the current year, later ones step a year
  const stepYear = (delta: number) => {
    const next = livingInYear === null ? new Date().getFullYear() : livingInYear + delta;
    onLivingInYearChange(Math.min(MAX_YEAR, Math.max(MIN_YEAR, next)));
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

      {/* Gender and living in year: one row each, like the generation rows below */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">{t('gender')}</span>
        <div className="flex gap-1" role="group" aria-label={t('gender')}>
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
                  'h-8 min-w-9 rounded-full border px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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

      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="livingInYear" className="text-sm font-normal">
          {t('livingInYear')}
        </Label>
        {/* A stepper like the generation rows; the year can also be typed */}
        <div className={cn(CONTROL_BOX, 'flex items-center justify-between border bg-card p-0.5')}>
          <button
            type="button"
            className={STEP_BUTTON}
            onClick={() => stepYear(-1)}
            disabled={livingInYear !== null && livingInYear <= MIN_YEAR}
            aria-label={`${t('livingInYear')} −`}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <input
            id="livingInYear"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder={t('year')}
            value={livingInYear ?? ''}
            onChange={handleYearChange}
            // A width of its own, so the field never collapses to nothing
            className="w-12 shrink-0 bg-transparent text-center text-sm tabular-nums placeholder:text-muted-foreground focus-visible:outline-none"
          />
          <button
            type="button"
            className={STEP_BUTTON}
            onClick={() => stepYear(1)}
            disabled={livingInYear !== null && livingInYear >= MAX_YEAR}
            aria-label={`${t('livingInYear')} +`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
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
