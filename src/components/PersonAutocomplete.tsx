'use client';

import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/components/LocaleProvider';
import { rankCandidates, type CandidateHint } from '@/lib/candidates';
import type { Gender, Person } from '@/types';
import { cn } from '@/lib/utils';

interface PersonAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  persons: Person[];
  /** Ids of persons in at least one relationship; the others are suggested first */
  linkedIds: Set<string>;
  /** Gender and birth years this slot expects, used to order suggestions */
  hint?: CandidateHint;
  /** Only offer persons of this gender */
  genderFilter?: Gender;
  excludeIds?: string[];
  placeholder: string;
  label: string;
  /** Label and input as two cells of a FormGrid row instead of stacked */
  inline?: boolean;
  /** Label for screen readers only, e.g. in a compact row */
  labelHidden?: boolean;
  /** A ✕ in the box clears the choice (onChange(''); the placeholder then says what that means) */
  clearable?: boolean;
  /**
   * Typed text is kept as a new person's name instead of being undone: `text` is the box's text,
   * `onTextChange` reports it, and typing clears a chosen person (onChange(''))
   */
  allowNew?: { text: string; onTextChange: (text: string) => void };
  disabled?: boolean;
  className?: string;
}

/** Text box that suggests persons by name, courtesy name or art name */
export function PersonAutocomplete({
  value,
  onChange,
  persons,
  linkedIds,
  hint,
  genderFilter,
  excludeIds = [],
  placeholder,
  label,
  inline = false,
  labelHidden = false,
  clearable = false,
  allowNew,
  disabled = false,
  className,
}: PersonAutocompleteProps) {
  const { t } = useLocale();
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputId = React.useId();

  const selectedPerson = useMemo(() => persons.find((p) => p.id === value), [persons, value]);

  useEffect(() => {
    if (!allowNew) setInputValue(selectedPerson?.name ?? '');
  }, [selectedPerson, allowNew]);
  const newText = allowNew?.text;
  useEffect(() => {
    if (newText !== undefined) setInputValue(newText);
  }, [newText]);

  // While the box shows the chosen person's name, suggest as if nothing were typed
  const query = selectedPerson && inputValue === selectedPerson.name ? '' : inputValue;
  const excludeKey = excludeIds.join('|');
  const suggestions = useMemo(
    () =>
      rankCandidates(genderFilter ? persons.filter((p) => p.gender === genderFilter) : persons, {
        query,
        excludeIds: excludeKey ? excludeKey.split('|') : [],
        linkedIds,
        hint,
      }),
    [persons, genderFilter, query, excludeKey, linkedIds, hint]
  );

  // Back to the top only when the suggested persons change, not on every render
  const suggestionsKey = suggestions.map((p) => p.id).join('|');
  useEffect(() => {
    setHighlightedIndex(0);
  }, [suggestionsKey]);

  const restore = () => {
    setShowSuggestions(false);
    if (!allowNew) setInputValue(selectedPerson?.name ?? '');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!suggestionsRef.current?.contains(target) && !inputRef.current?.contains(target)) {
        setShowSuggestions(false);
        if (selectedPerson && !allowNew) setInputValue(selectedPerson.name);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedPerson, allowNew]);

  // While the list is open, Escape closes only the list. The dialog listens for Escape on the
  // document, so this catches it earlier, on the window.
  const isListOpen = showSuggestions && suggestions.length > 0;
  useEffect(() => {
    if (!isListOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.activeElement !== inputRef.current) return;
      event.stopPropagation();
      setShowSuggestions(false);
      if (!allowNew) setInputValue(selectedPerson?.name ?? '');
    };
    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [isListOpen, selectedPerson, allowNew]);

  const select = (person: Person) => {
    setInputValue(person.name);
    allowNew?.onTextChange(person.name);
    onChange(person.id);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      restore();
      return;
    }
    // The list opens on a click, typing or ↓, not on focus, so it does not cover a dialog that
    // has just opened with this box focused
    if (!showSuggestions && e.key === 'ArrowDown') {
      e.preventDefault();
      setShowSuggestions(true);
      return;
    }
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions[highlightedIndex]) select(suggestions[highlightedIndex]);
    }
  };

  return (
    <div className={cn(inline ? 'contents' : labelHidden ? undefined : 'space-y-2', !inline && className)}>
      <Label htmlFor={inputId} className={cn(inline && 'text-right', labelHidden && 'sr-only')}>
        {label}
      </Label>
      <div className={cn('relative', inline && className)}>
        <Input
          id={inputId}
          ref={inputRef}
          placeholder={placeholder}
          value={inputValue}
          disabled={disabled}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowSuggestions(true);
            if (allowNew) {
              allowNew.onTextChange(e.target.value);
              if (value) onChange('');
            }
          }}
          onKeyDown={handleKeyDown}
          onClick={() => setShowSuggestions(true)}
          autoComplete="off"
          className={cn(labelHidden && 'h-9', clearable && (value || allowNew?.text) && 'pr-8')}
        />
        {clearable && (value || allowNew?.text) && !disabled && (
          <button
            type="button"
            aria-label={t('clearChoice')}
            title={t('clearChoice')}
            onClick={() => {
              onChange('');
              setInputValue('');
              allowNew?.onTextChange('');
              setShowSuggestions(false);
            }}
            className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover shadow-lg"
          >
            {suggestions.map((person, index) => (
              <div
                key={person.id}
                className={cn(
                  'flex cursor-pointer items-center gap-2 px-3 py-2',
                  index === highlightedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                )}
                onClick={() => select(person)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <span className="text-sm font-medium">{person.name}</span>
                <span className="text-xs text-muted-foreground">{person.gender}</span>
                {person.birthYear && (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {person.birthYear}
                    {person.deathYear ? `–${person.deathYear}` : ''}
                  </span>
                )}
                {!linkedIds.has(person.id) && (
                  <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    {t('unlinked')}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
