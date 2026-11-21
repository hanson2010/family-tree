'use client';

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSession } from 'next-auth/react';
import { useLocale } from '@/components/LocaleProvider';
import { Search, UserPlus, GitBranch, Users, Shuffle, X, ScanText, Images } from 'lucide-react';
import type { Person, Gender, GenerationRange } from '@/types';
import { FilterControls } from '@/components/FilterControls';
import { PersonAvatar } from '@/components/PersonAvatar';
import { cn } from '@/lib/utils';

interface LeftPanelProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddPerson: () => void;
  onAddRelationship: () => void;
  onQuickAddRelationship: () => void;
  onImport: () => void;
  onGroupPhoto: () => void;
  onRefresh: () => void;
  persons: Person[];
  onSelectPerson: (personId: string) => void;
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
  onAddPerson,
  onAddRelationship,
  onQuickAddRelationship,
  onImport,
  onGroupPhoto,
  onRefresh,
  persons,
  onSelectPerson,
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

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Filter persons based on search query
  const filteredPersons = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.trim().toLowerCase();
    return persons
      .filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.courtesyName?.toLowerCase().includes(query) ||
          p.artName?.toLowerCase().includes(query)
      )
      .slice(0, 10);
  }, [persons, searchQuery]);

  // Reset highlighted index when suggestions change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredPersons.length]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
    setShowSuggestions(true);
  };

  const handleSelectPerson = (person: Person) => {
    onSearchChange(person.name);
    setShowSuggestions(false);
    onSelectPerson(person.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      return;
    }
    if (!showSuggestions || filteredPersons.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < filteredPersons.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredPersons[highlightedIndex]) {
          handleSelectPerson(filteredPersons[highlightedIndex]);
        }
        break;
    }
  };

  const sectionTitle = 'text-xs font-semibold uppercase tracking-wider text-muted-foreground';

  return (
    <div className="flex min-h-full flex-col gap-6 p-4">
      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          id="search"
          aria-label={t('searchByName')}
          placeholder={t('searchByName')}
          value={searchQuery}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => searchQuery.trim() && setShowSuggestions(true)}
          className="bg-card pl-9 pr-9"
          autoComplete="off"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              onSearchChange('');
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            title={t('clearSearch')}
            aria-label={t('clearSearch')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Auto-complete suggestions */}
        {showSuggestions && filteredPersons.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-72 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg"
          >
            {filteredPersons.map((person, index) => (
              <button
                key={person.id}
                type="button"
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left',
                  index === highlightedIndex && 'bg-accent'
                )}
                onClick={() => handleSelectPerson(person)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <PersonAvatar person={person} className="h-7 w-7 text-xs" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{person.name}</span>
                {person.birthYear && (
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {person.birthYear}
                    {person.deathYear ? `–${person.deathYear}` : ''}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <Button
        variant="outline"
        className="w-full justify-start bg-card"
        onClick={onRefresh}
        disabled={persons.length === 0}
      >
        <Shuffle className="mr-2 h-4 w-4" />
        {t('refresh')}
      </Button>

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
          <Button variant="outline" className="w-full justify-start bg-card" onClick={onQuickAddRelationship}>
            <Users className="mr-2 h-4 w-4" />
            {t('quickAddRelationship')}
          </Button>
          <Button variant="outline" className="w-full justify-start bg-card" onClick={onAddRelationship}>
            <GitBranch className="mr-2 h-4 w-4" />
            {t('addRelationship')}
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

      <p className="mt-auto pt-2 text-center text-xs text-muted-foreground/70">{t('appName')} · v1.0.0</p>
    </div>
  );
}
