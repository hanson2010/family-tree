'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useLocale } from '@/components/LocaleProvider';
import type { FilterState, GenerationRange, Gender } from '@/types';
import { Gender as GenderEnum } from '@/types';
import { Search, Filter, X } from 'lucide-react';

interface FilterControlsProps {
  filters: FilterState;
  generationRange: GenerationRange;
  onFiltersChange: (filters: Partial<FilterState>) => void;
  onGenerationRangeChange: (range: Partial<GenerationRange>) => void;
  onReset: () => void;
}

export function FilterControls({
  filters,
  generationRange,
  onFiltersChange,
  onGenerationRangeChange,
  onReset,
}: FilterControlsProps) {
  const { t } = useLocale();

  const GENDER_LABELS: Record<Gender, string> = {
    [GenderEnum.MALE]: t('male'),
    [GenderEnum.FEMALE]: t('female'),
    [GenderEnum.UNKNOWN]: t('unknown'),
  };

  const hasActiveFilters =
    filters.genders.length > 0 ||
    filters.relationshipTypes.length > 0 ||
    filters.searchQuery !== '' ||
    filters.showPrivate;

  return (
    <div className="bg-card border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          <h3 className="font-semibold">{t('filters')}</h3>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            <X className="w-4 h-4 mr-1" />
            {t('resetFilters')}
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="space-y-2">
        <Label htmlFor="search">{t('searchByName')}</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="search"
            placeholder={t('searchByName')}
            value={filters.searchQuery}
            onChange={(e) => onFiltersChange({ searchQuery: e.target.value })}
            className="pl-9"
          />
        </div>
      </div>

      {/* Generation Range */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t('ancestors')}</Label>
          <Select
            value={generationRange.ancestors.toString()}
            onValueChange={(value) => onGenerationRangeChange({ ancestors: parseInt(value) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={n.toString()}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t('descendants')}</Label>
          <Select
            value={generationRange.descendants.toString()}
            onValueChange={(value) => onGenerationRangeChange({ descendants: parseInt(value) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={n.toString()}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Gender Filter */}
      <div className="space-y-2">
        <Label>{t('gender')}</Label>
        <div className="flex gap-2">
          {Object.entries(GENDER_LABELS).map(([value, label]) => (
            <Button
              key={value}
              variant={filters.genders.includes(value as Gender) ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                const current = filters.genders;
                const isSelected = current.includes(value as Gender);
                onFiltersChange({
                  genders: isSelected
                    ? current.filter((g) => g !== value)
                    : [...current, value as Gender],
                });
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Show Private */}
      <div className="flex items-center justify-between">
        <Label htmlFor="showPrivate">{t('showPrivate')}</Label>
        <Switch
          id="showPrivate"
          checked={filters.showPrivate}
          onCheckedChange={(checked) => onFiltersChange({ showPrivate: checked })}
        />
      </div>
    </div>
  );
}
