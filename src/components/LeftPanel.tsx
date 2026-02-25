'use client';

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSession } from 'next-auth/react';
import { useLocale } from '@/components/LocaleProvider';
import { Search, UserPlus, GitBranch, Database, Zap, RefreshCw } from 'lucide-react';
import type { Person, Gender } from '@/types';
import { FilterControls } from '@/components/FilterControls';

interface LeftPanelProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddPerson: () => void;
  onAddRelationship: () => void;
  onQuickAddRelationship: () => void;
  onRefresh: () => void;
  onSeedData: () => void;
  persons: Person[];
  onSelectPerson: (personId: string) => void;
  // Filter props
  filterGenders: Gender[];
  filterLivingInYear: number | null;
  onFilterGendersChange: (genders: Gender[]) => void;
  onFilterLivingInYearChange: (year: number | null) => void;
  onFilterReset: () => void;
  // Filtered persons count for refresh button state
  filteredPersonsCount?: number;
}

export function LeftPanel({
  searchQuery,
  onSearchChange,
  onAddPerson,
  onAddRelationship,
  onQuickAddRelationship,
  onRefresh,
  onSeedData,
  persons,
  onSelectPerson,
  filterGenders,
  filterLivingInYear,
  onFilterGendersChange,
  onFilterLivingInYearChange,
  onFilterReset,
  filteredPersonsCount,
}: LeftPanelProps) {
  const { data: session, status } = useSession();
  const { t } = useLocale();
  const isAuthenticated = status === 'authenticated';

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Filter persons based on search query
  const filteredPersons = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return persons
      .filter(p => p.name.toLowerCase().includes(query))
      .slice(0, 10); // Limit to 10 suggestions
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
    if (!showSuggestions || filteredPersons.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredPersons.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredPersons[highlightedIndex]) {
          handleSelectPerson(filteredPersons[highlightedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  const handleFocus = () => {
    if (searchQuery.trim()) {
      setShowSuggestions(true);
    }
  };

  return (
    <div className="bg-card border rounded-lg p-4 space-y-4">
      {/* Search */}
      <div className="space-y-2">
        <Label htmlFor="search">{t('searchByName')}</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
          <Input
            ref={inputRef}
            id="search"
            placeholder={t('searchByName')}
            value={searchQuery}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            className="pl-9"
            autoComplete="off"
          />
          {/* Auto-complete suggestions */}
          {showSuggestions && filteredPersons.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-20 max-h-60 overflow-y-auto"
            >
              {filteredPersons.map((person, index) => (
                <div
                  key={person.id}
                  className={`px-3 py-2 cursor-pointer flex items-center gap-2 ${
                    index === highlightedIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent/50'
                  }`}
                  onClick={() => handleSelectPerson(person)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <span className="font-medium text-sm">{person.name}</span>
                  {person.birthYear && (
                    <span className="text-xs text-muted-foreground">
                      ({person.birthYear}
                      {person.deathYear ? ` - ${person.deathYear}` : ''})
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filter Controls */}
      <FilterControls
        genders={filterGenders}
        livingInYear={filterLivingInYear}
        onGendersChange={onFilterGendersChange}
        onLivingInYearChange={onFilterLivingInYearChange}
        onReset={onFilterReset}
      />

      {/* Divider - only show if there are actions below */}
      {isAuthenticated && <div className="border-t" />}

      {/* Actions */}
      <div className="space-y-2">
        {isAuthenticated && (
          <>
            {/* Add Person */}
            <Button
              className="w-full justify-start"
              onClick={onAddPerson}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {t('addPerson')}
            </Button>

            {/* Add Relationship (Advanced) */}
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={onAddRelationship}
            >
              <GitBranch className="h-4 w-4 mr-2" />
              {t('addRelationship')}
            </Button>

            {/* Quick Add Relationship */}
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={onQuickAddRelationship}
            >
              <Zap className="h-4 w-4 mr-2" />
              {t('quickAddRelationship')}
            </Button>
          </>
        )}

        {/* Refresh - Random Select (available for all users) */}
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={onRefresh}
          disabled={persons.length === 0}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('refresh')}
        </Button>
      </div>

      {/* Seed Data (Development) - Only for authenticated users */}
      {isAuthenticated && (
        <>
          <div className="border-t" />
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground"
            onClick={onSeedData}
          >
            <Database className="h-4 w-4 mr-2" />
            {t('seedData')}
          </Button>
        </>
      )}

      {/* Footer */}
      <div className="pt-2 border-t">
        <p className="text-xs text-muted-foreground text-center">
          {t('appName')}
        </p>
        <p className="text-xs text-muted-foreground text-center mt-1">
          v1.0.0
        </p>
      </div>
    </div>
  );
}
