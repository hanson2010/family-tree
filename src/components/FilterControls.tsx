'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/components/LocaleProvider';
import type { Gender } from '@/types';
import { Gender as GenderEnum } from '@/types';
import { Filter, X } from 'lucide-react';

interface FilterControlsProps {
  genders: Gender[];
  livingInYear: number | null;
  onGendersChange: (genders: Gender[]) => void;
  onLivingInYearChange: (year: number | null) => void;
  onReset: () => void;
}

export function FilterControls({
  genders,
  livingInYear,
  onGendersChange,
  onLivingInYearChange,
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          <h3 className="font-semibold text-sm">{t('filters')}</h3>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onReset} className="h-6 px-2 text-xs">
            <X className="w-3 h-3 mr-1" />
            {t('resetFilters')}
          </Button>
        )}
      </div>

      {/* Living in Year Filter */}
      <div className="space-y-2">
        <Label htmlFor="livingInYear" className="text-sm">{t('livingInYear')}</Label>
        <Input
          id="livingInYear"
          type="number"
          placeholder={t('year')}
          value={livingInYear ?? ''}
          onChange={handleYearChange}
          min={0}
          max={2100}
          className="h-8"
        />
      </div>

      {/* Gender Filter */}
      <div className="space-y-2">
        <Label className="text-sm">{t('gender')}</Label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(GENDER_LABELS).map(([value, label]) => (
            <Button
              key={value}
              variant={genders.includes(value as Gender) ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                const isSelected = genders.includes(value as Gender);
                onGendersChange(
                  isSelected
                    ? genders.filter((g) => g !== value)
                    : [...genders, value as Gender]
                );
              }}
              className="h-7 text-xs"
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
