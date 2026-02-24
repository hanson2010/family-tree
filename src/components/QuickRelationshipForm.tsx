'use client';

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useLocale } from '@/components/LocaleProvider';
import type { RelationshipFormData, Person, Gender } from '@/types';
import { RelationshipType as RelType, Gender as GenderEnum } from '@/types';
import { Loader2, Users } from 'lucide-react';

interface QuickRelationshipFormProps {
  isOpen: boolean;
  persons: Person[];
  onSubmit: (data: RelationshipFormData) => Promise<void>;
  onClose: () => void;
}

// Person autocomplete input component
interface PersonAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  persons: Person[];
  excludeIds?: string[];
  placeholder: string;
  label: string;
  genderFilter?: Gender;
}

function PersonAutocomplete({
  value,
  onChange,
  persons,
  excludeIds = [],
  placeholder,
  label,
  genderFilter,
}: PersonAutocompleteProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Get the selected person's name
  const selectedPerson = React.useMemo(() => {
    return persons.find(p => p.id === value);
  }, [persons, value]);

  // Initialize input value with selected person's name
  useEffect(() => {
    if (selectedPerson) {
      setInputValue(selectedPerson.name);
    } else {
      setInputValue('');
    }
  }, [selectedPerson]);

  // Filter persons based on input
  const filteredPersons = React.useMemo(() => {
    let filtered = persons.filter(p => !excludeIds.includes(p.id));

    // Apply gender filter if specified
    if (genderFilter) {
      filtered = filtered.filter(p => p.gender === genderFilter);
    }

    if (!inputValue.trim()) {
      return filtered.slice(0, 10);
    }
    const query = inputValue.toLowerCase();
    return filtered
      .filter(p => p.name.toLowerCase().includes(query))
      .slice(0, 10);
  }, [persons, excludeIds, inputValue, genderFilter]);

  // Reset highlighted index when suggestions change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredPersons.length]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        // Reset input to selected person's name if no valid selection
        if (selectedPerson) {
          setInputValue(selectedPerson.name);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedPerson]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setShowSuggestions(true);
  };

  const handleSelectPerson = (person: Person) => {
    setInputValue(person.name);
    onChange(person.id);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || filteredPersons.length === 0) {
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        if (selectedPerson) {
          setInputValue(selectedPerson.name);
        }
      }
      return;
    }

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
        if (selectedPerson) {
          setInputValue(selectedPerson.name);
        }
        break;
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          autoComplete="off"
        />
        {showSuggestions && filteredPersons.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto"
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
                <span className="text-xs text-muted-foreground">({person.gender})</span>
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
  );
}

export function QuickRelationshipForm({
  isOpen,
  persons,
  onSubmit,
  onClose,
}: QuickRelationshipFormProps) {
  const { toast } = useToast();
  const { t } = useLocale();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [dadId, setDadId] = useState('');
  const [momId, setMomId] = useState('');
  const [childId, setChildId] = useState('');

  // Marriage dates
  const [marriageStartYear, setMarriageStartYear] = useState<number | null>(null);
  const [marriageStartMonth, setMarriageStartMonth] = useState<number | null>(null);
  const [marriageStartDay, setMarriageStartDay] = useState<number | null>(null);
  const [marriageEndYear, setMarriageEndYear] = useState<number | null>(null);
  const [marriageEndMonth, setMarriageEndMonth] = useState<number | null>(null);
  const [marriageEndDay, setMarriageEndDay] = useState<number | null>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setDadId('');
      setMomId('');
      setChildId('');
      setMarriageStartYear(null);
      setMarriageStartMonth(null);
      setMarriageStartDay(null);
      setMarriageEndYear(null);
      setMarriageEndMonth(null);
      setMarriageEndDay(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate at least one relationship is being created
    if (!dadId && !momId && !childId) {
      toast({
        variant: 'destructive',
        title: t('validationError'),
        description: t('mustSelectParents'),
      });
      return;
    }

    // If child is selected, need at least one parent
    if (childId && !dadId && !momId) {
      toast({
        variant: 'destructive',
        title: t('validationError'),
        description: t('mustSelectParents'),
      });
      return;
    }

    // Check for duplicate selections
    const selectedIds = [dadId, momId, childId].filter(Boolean);
    if (new Set(selectedIds).size !== selectedIds.length) {
      toast({
        variant: 'destructive',
        title: t('validationError'),
        description: t('duplicatePersonSelection'),
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create marriage relationship if both dad and mom are selected
      if (dadId && momId) {
        const marriageData: RelationshipFormData = {
          personAId: dadId,
          personBId: momId,
          type: RelType.SPOUSE,
          startYear: marriageStartYear,
          startMonth: marriageStartMonth,
          startDay: marriageStartDay,
          endYear: marriageEndYear,
          endMonth: marriageEndMonth,
          endDay: marriageEndDay,
        };
        await onSubmit(marriageData);
      }

      // Create parent-child relationships if child is selected
      if (childId) {
        // Dad to child
        if (dadId) {
          const dadToChildData: RelationshipFormData = {
            personAId: dadId,
            personBId: childId,
            type: RelType.PARENT_CHILD,
            startYear: null,
            startMonth: null,
            startDay: null,
            endYear: null,
            endMonth: null,
            endDay: null,
          };
          await onSubmit(dadToChildData);
        }

        // Mom to child
        if (momId) {
          const momToChildData: RelationshipFormData = {
            personAId: momId,
            personBId: childId,
            type: RelType.PARENT_CHILD,
            startYear: null,
            startMonth: null,
            startDay: null,
            endYear: null,
            endMonth: null,
            endDay: null,
          };
          await onSubmit(momToChildData);
        }
      }

      toast({
        title: t('relationshipCreated'),
        description: t('relationshipUpdated'),
      });

      // Reset form
      setDadId('');
      setMomId('');
      setChildId('');
      setMarriageStartYear(null);
      setMarriageStartMonth(null);
      setMarriageStartDay(null);
      setMarriageEndYear(null);
      setMarriageEndMonth(null);
      setMarriageEndDay(null);
      onClose();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error instanceof Error ? error.message : t('failedToSave'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('quickAddRelationshipTitle')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('quickAddRelationshipDesc')}
          </p>

          {/* Dad */}
          <PersonAutocomplete
            value={dadId}
            onChange={setDadId}
            persons={persons}
            excludeIds={[momId, childId].filter(Boolean)}
            placeholder={t('searchByName')}
            label={t('father')}
            genderFilter={GenderEnum.MALE}
          />

          {/* Mom */}
          <PersonAutocomplete
            value={momId}
            onChange={setMomId}
            persons={persons}
            excludeIds={[dadId, childId].filter(Boolean)}
            placeholder={t('searchByName')}
            label={t('mother')}
            genderFilter={GenderEnum.FEMALE}
          />

          {/* Child */}
          <PersonAutocomplete
            value={childId}
            onChange={setChildId}
            persons={persons}
            excludeIds={[dadId, momId].filter(Boolean)}
            placeholder={t('searchByName')}
            label={t('child')}
          />

          {/* Marriage Dates */}
          <div className="border-t pt-4 mt-4">
            <Label className="text-sm font-medium">{t('marriageDateOptional')}</Label>
          </div>

          {/* Marriage Start Date */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{t('startDate')}</Label>
            <div className="grid grid-cols-3 gap-2">
              <Input
                type="number"
                placeholder={t('year')}
                value={marriageStartYear || ''}
                onChange={(e) => setMarriageStartYear(e.target.value ? parseInt(e.target.value) : null)}
                min={0}
                max={2100}
                disabled={isSubmitting}
              />
              <Input
                type="number"
                placeholder={t('month')}
                value={marriageStartMonth || ''}
                onChange={(e) => setMarriageStartMonth(e.target.value ? parseInt(e.target.value) : null)}
                min={1}
                max={12}
                disabled={isSubmitting}
              />
              <Input
                type="number"
                placeholder={t('day')}
                value={marriageStartDay || ''}
                onChange={(e) => setMarriageStartDay(e.target.value ? parseInt(e.target.value) : null)}
                min={1}
                max={31}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Marriage End Date */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{t('endDate')}</Label>
            <div className="grid grid-cols-3 gap-2">
              <Input
                type="number"
                placeholder={t('year')}
                value={marriageEndYear || ''}
                onChange={(e) => setMarriageEndYear(e.target.value ? parseInt(e.target.value) : null)}
                min={0}
                max={2100}
                disabled={isSubmitting}
              />
              <Input
                type="number"
                placeholder={t('month')}
                value={marriageEndMonth || ''}
                onChange={(e) => setMarriageEndMonth(e.target.value ? parseInt(e.target.value) : null)}
                min={1}
                max={12}
                disabled={isSubmitting}
              />
              <Input
                type="number"
                placeholder={t('day')}
                value={marriageEndDay || ''}
                onChange={(e) => setMarriageEndDay(e.target.value ? parseInt(e.target.value) : null)}
                min={1}
                max={31}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('saving')}
                </>
              ) : (
                t('save')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
