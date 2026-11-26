'use client';

import * as React from 'react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSession } from 'next-auth/react';
import { useLocale } from '@/components/LocaleProvider';
import { Search, UserPlus, GitBranch, Users, Shuffle, X, ScanText, Images, RefreshCw } from 'lucide-react';
import type { Person, Gender, GenerationRange } from '@/types';
import { FilterControls } from '@/components/FilterControls';
import { cn } from '@/lib/utils';

/** The search shown on the canvas: how many persons match, and how many are drawn */
export interface SearchSummary {
  query: string;
  total: number;
  shown: number;
}

interface LeftPanelProps {
  /** Text in the search box */
  searchQuery: string;
  onSearchChange: (query: string) => void;
  /** Run a search (Enter or the search button); '' ends it */
  onSearch: (query: string) => void;
  /** The search shown on the canvas, or null */
  search: SearchSummary | null;
  onAddPerson: () => void;
  onAddRelationship: () => void;
  onQuickAddRelationship: () => void;
  onImport: () => void;
  onGroupPhoto: () => void;
  onRefresh: () => void;
  /** Load persons and relationships again, keeping the selected person */
  onReload: () => void;
  isReloading: boolean;
  persons: Person[];
  // Filter props
  filterGenders: Gender[];
  filterLivingInYear: number | null;
  generationRange: GenerationRange;
  onFilterGendersChange: (genders: Gender[]) => void;
  onFilterLivingInYearChange: (year: number | null) => void;
  onGenerationRangeChange: (range: GenerationRange) => void;
  onFilterReset: () => void;
}

export function LeftPanel({
  searchQuery,
  onSearchChange,
  onSearch,
  search,
  onAddPerson,
  onAddRelationship,
  onQuickAddRelationship,
  onImport,
  onGroupPhoto,
  onRefresh,
  onReload,
  isReloading,
  persons,
  filterGenders,
  filterLivingInYear,
  generationRange,
  onFilterGendersChange,
  onFilterLivingInYearChange,
  onGenerationRangeChange,
  onFilterReset,
}: LeftPanelProps) {
  const { status } = useSession();
  const { t } = useLocale();
  const isAuthenticated = status === 'authenticated';

  const inputRef = useRef<HTMLInputElement>(null);

  const clearSearch = () => {
    onSearchChange('');
    onSearch('');
    inputRef.current?.focus();
  };

  const sectionTitle = 'text-xs font-semibold uppercase tracking-wider text-muted-foreground';

  return (
    <div className="flex min-h-full flex-col gap-6 p-4">
      {/* Search: results are drawn on the canvas */}
      <div className="space-y-2">
        <form
          role="search"
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSearch(searchQuery.trim());
          }}
        >
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              id="search"
              type="search"
              aria-label={t('searchByName')}
              placeholder={t('searchByName')}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && search && clearSearch()}
              className="bg-card pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
              autoComplete="off"
            />
            {(searchQuery || search) && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                title={t('clearSearch')}
                aria-label={t('clearSearch')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button type="submit" className="shrink-0" disabled={!searchQuery.trim()}>
            {t('search')}
          </Button>
        </form>

        {search && (
          <div className="space-y-0.5 text-xs text-muted-foreground" aria-live="polite">
            {search.total === 0 ? (
              <p>{t('noPersonFound')}</p>
            ) : (
              <>
                <p className="font-medium text-foreground">
                  {t('searchFound').replace('{query}', search.query).replace('{n}', String(search.total))}
                </p>
                {search.shown < search.total && (
                  <p>{t('searchShowingOldest').replace('{n}', String(search.shown))}</p>
                )}
                <p>{t('searchHint')}</p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1 justify-start bg-card"
          onClick={onRefresh}
          disabled={persons.length === 0}
        >
          <Shuffle className="mr-2 h-4 w-4" />
          {t('refresh')}
        </Button>
        {/* Loads persons and relationships again, keeping the selected person */}
        <Button
          variant="outline"
          size="icon"
          className="shrink-0 bg-card"
          onClick={onReload}
          disabled={isReloading}
          title={t('reloadData')}
          aria-label={t('reloadData')}
        >
          <RefreshCw className={cn('h-4 w-4', isReloading && 'animate-spin')} />
        </Button>
      </div>

      <FilterControls
        genders={filterGenders}
        livingInYear={filterLivingInYear}
        generationRange={generationRange}
        onGendersChange={onFilterGendersChange}
        onLivingInYearChange={onFilterLivingInYearChange}
        onGenerationRangeChange={onGenerationRangeChange}
        onReset={onFilterReset}
      />

      {/* Editing actions */}
      {isAuthenticated && (
        <div className="space-y-2">
          <h3 className={cn(sectionTitle, 'mb-3')}>{t('actions')}</h3>
          <Button className="w-full justify-start" onClick={onAddPerson}>
            <UserPlus className="mr-2 h-4 w-4" />
            {t('addPerson')}
          </Button>
          <Button variant="outline" className="w-full justify-start bg-card" onClick={onAddRelationship}>
            <GitBranch className="mr-2 h-4 w-4" />
            {t('addRelationship')}
          </Button>
          <Button variant="outline" className="w-full justify-start bg-card" onClick={onQuickAddRelationship}>
            <Users className="mr-2 h-4 w-4" />
            {t('quickAddRelationship')}
          </Button>
          <Button variant="outline" className="w-full justify-start bg-card" onClick={onImport}>
            <ScanText className="mr-2 h-4 w-4" />
            {t('importRecords')}
          </Button>
          <Button variant="outline" className="w-full justify-start bg-card" onClick={onGroupPhoto}>
            <Images className="mr-2 h-4 w-4" />
            {t('groupPhoto')}
          </Button>
        </div>
      )}

      {!isAuthenticated && status !== 'loading' && (
        <p className="text-xs leading-relaxed text-muted-foreground">{t('signInSubtitle')}</p>
      )}

      <p className="mt-auto pt-2 text-center text-xs text-muted-foreground/70">{t('appName')} · v{process.env.NEXT_PUBLIC_APP_VERSION}</p>
    </div>
  );
}
