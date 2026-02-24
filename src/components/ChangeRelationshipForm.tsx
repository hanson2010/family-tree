'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useRef } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import type { Relationship, RelationshipFormData, RelationshipType, Person, Gender } from '@/types';
import { RelationshipType as RelType, Gender as GenderEnum } from '@/types';
import { Loader2, Trash2, Edit, AlertTriangle, User } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';

interface ModifyOrRemoveRelationshipFormProps {
  isOpen: boolean;
  relationships: Relationship[];
  persons: Person[];
  preselectedPersonId?: string;
  onDelete: (relationshipId: string) => Promise<void>;
  onUpdate: (relationshipId: string, data: RelationshipFormData) => Promise<void>;
  onClose: () => void;
}

const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  [RelType.PARENT_CHILD]: '父母子女',
  [RelType.SIBLING]: '兄弟姐妹',
  [RelType.HALF_SIBLING]: '同父异母/同母异父',
  [RelType.SPOUSE]: '配偶',
  [RelType.CONCUBINE]: '妾',
  [RelType.BETROTHED]: '订婚',
  [RelType.ADOPTIVE_PARENT]: '养父母',
  [RelType.FOSTER_PARENT]: '寄养父母',
  [RelType.SWORN_SIBLING]: '结拜兄弟姐妹',
};

// Person autocomplete input component
interface PersonAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  persons: Person[];
  excludeIds?: string[];
  placeholder: string;
  label: string;
}

function PersonAutocomplete({
  value,
  onChange,
  persons,
  excludeIds = [],
  placeholder,
  label,
}: PersonAutocompleteProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const selectedPerson = React.useMemo(() => {
    return persons.find(p => p.id === value);
  }, [persons, value]);

  useEffect(() => {
    if (selectedPerson) {
      setInputValue(selectedPerson.name);
    } else {
      setInputValue('');
    }
  }, [selectedPerson]);

  const filteredPersons = React.useMemo(() => {
    let filtered = persons.filter(p => !excludeIds.includes(p.id));

    if (!inputValue.trim()) {
      return filtered.slice(0, 10);
    }
    const query = inputValue.toLowerCase();
    return filtered
      .filter(p => p.name.toLowerCase().includes(query))
      .slice(0, 10);
  }, [persons, excludeIds, inputValue]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredPersons.length]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
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

export function ChangeRelationshipForm({
  isOpen,
  relationships,
  persons,
  preselectedPersonId,
  onDelete,
  onUpdate,
  onClose,
}: ModifyOrRemoveRelationshipFormProps) {
  const { toast } = useToast();
  const { t } = useLocale();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Person selection
  const [selectedPersonId, setSelectedPersonId] = useState('');

  // Selected relationship for editing
  const [editingRelationshipId, setEditingRelationshipId] = useState<string | null>(null);

  // Edit form state
  const [editStartYear, setEditStartYear] = useState<number | null>(null);
  const [editStartMonth, setEditStartMonth] = useState<number | null>(null);
  const [editStartDay, setEditStartDay] = useState<number | null>(null);
  const [editEndYear, setEditEndYear] = useState<number | null>(null);
  const [editEndMonth, setEditEndMonth] = useState<number | null>(null);
  const [editEndDay, setEditEndDay] = useState<number | null>(null);

  // Create a map for quick person lookup
  const personMap = useMemo(() => {
    const map = new Map<string, Person>();
    persons.forEach(p => map.set(p.id, p));
    return map;
  }, [persons]);

  // Get relationships for selected person
  const personRelationships = useMemo(() => {
    if (!selectedPersonId) return [];

    return relationships.filter(rel =>
      rel.personAId === selectedPersonId || rel.personBId === selectedPersonId
    ).map(rel => {
      const isPersonA = rel.personAId === selectedPersonId;
      const otherPersonId = isPersonA ? rel.personBId : rel.personAId;
      const otherPerson = personMap.get(otherPersonId);
      const otherName = otherPerson?.name || t('unknown');

      // For PARENT_CHILD, determine if the selected person is parent or child
      let relationshipDescription = RELATIONSHIP_LABELS[rel.type];
      if (rel.type === RelType.PARENT_CHILD) {
        if (isPersonA) {
          relationshipDescription = t('isParentOf').replace('{name}', otherName);
        } else {
          relationshipDescription = t('isChildOf').replace('{name}', otherName);
        }
      } else if (rel.type === RelType.SPOUSE) {
        relationshipDescription = t('spouseWith').replace('{name}', otherName);
      } else {
        relationshipDescription = t('relationshipWith').replace('{name}', otherName).replace('{type}', RELATIONSHIP_LABELS[rel.type]);
      }

      return {
        ...rel,
        otherPersonName: otherPerson?.name || t('unknown'),
        otherPersonGender: otherPerson?.gender,
        relationshipDescription,
        isPersonA,
      };
    });
  }, [selectedPersonId, relationships, personMap, t]);

  // Reset when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedPersonId(preselectedPersonId || '');
      setEditingRelationshipId(null);
    }
  }, [isOpen, preselectedPersonId]);

  // Populate edit form when relationship is selected
  useEffect(() => {
    if (editingRelationshipId) {
      const rel = relationships.find(r => r.id === editingRelationshipId);
      if (rel) {
        setEditStartYear(rel.startYear || null);
        setEditStartMonth(rel.startMonth || null);
        setEditStartDay(rel.startDay || null);
        setEditEndYear(rel.endYear || null);
        setEditEndMonth(rel.endMonth || null);
        setEditEndDay(rel.endDay || null);
      }
    }
  }, [editingRelationshipId, relationships]);

  const handleDelete = async (relationshipId: string) => {
    setIsDeleting(true);
    try {
      await onDelete(relationshipId);
      toast({
        title: t('relationshipDeleted'),
        description: t('relationshipDeleted'),
      });
      setEditingRelationshipId(null);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error instanceof Error ? error.message : t('failedToDeleteRelationship'),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingRelationshipId) return;

    const rel = relationships.find(r => r.id === editingRelationshipId);
    if (!rel) return;

    setIsUpdating(true);
    try {
      const data: RelationshipFormData = {
        personAId: rel.personAId,
        personBId: rel.personBId,
        type: rel.type,
        startYear: editStartYear,
        startMonth: editStartMonth,
        startDay: editStartDay,
        endYear: editEndYear,
        endMonth: editEndMonth,
        endDay: editEndDay,
      };

      await onUpdate(editingRelationshipId, data);
      toast({
        title: t('relationshipUpdated'),
        description: t('relationshipUpdated'),
      });
      setEditingRelationshipId(null);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error instanceof Error ? error.message : t('failedToUpdateRelationship'),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            {t('changeRelationship')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Person Selection - only show if no preselected person */}
          {!preselectedPersonId && (
            <PersonAutocomplete
              value={selectedPersonId}
              onChange={setSelectedPersonId}
              persons={persons}
              placeholder={t('searchByName')}
              label={t('selectPerson')}
            />
          )}

          {/* Relationships List */}
          {selectedPersonId && personRelationships.length > 0 && (
            <div className="space-y-2">
              <Label>{t('personRelationships')}</Label>
              <div className="max-h-[200px] overflow-y-auto border rounded-md">
                {personRelationships.map((rel) => (
                  <div
                    key={rel.id}
                    className={`px-4 py-3 cursor-pointer border-b last:border-b-0 flex items-center justify-between ${
                      editingRelationshipId === rel.id
                        ? 'bg-accent'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setEditingRelationshipId(
                      editingRelationshipId === rel.id ? null : rel.id
                    )}
                  >
                    <div>
                      <div className="font-medium text-sm">{rel.relationshipDescription}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Edit className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedPersonId && personRelationships.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              {t('noRelationships')}
            </p>
          )}

          {/* Edit Form */}
          {editingRelationshipId && (
            <div className="border rounded-md p-4 space-y-4 bg-muted/30">
              {(() => {
                const rel = personRelationships.find(r => r.id === editingRelationshipId);
                if (!rel) return null;

                return (
                  <>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      {t('editRelationshipDates')}
                    </div>

                    {/* Start Date */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">{t('startDate')}</Label>
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          type="number"
                          placeholder={t('year')}
                          value={editStartYear || ''}
                          onChange={(e) => setEditStartYear(e.target.value ? parseInt(e.target.value) : null)}
                          min={0}
                          max={2100}
                        />
                        <Input
                          type="number"
                          placeholder={t('month')}
                          value={editStartMonth || ''}
                          onChange={(e) => setEditStartMonth(e.target.value ? parseInt(e.target.value) : null)}
                          min={1}
                          max={12}
                        />
                        <Input
                          type="number"
                          placeholder={t('day')}
                          value={editStartDay || ''}
                          onChange={(e) => setEditStartDay(e.target.value ? parseInt(e.target.value) : null)}
                          min={1}
                          max={31}
                        />
                      </div>
                    </div>

                    {/* End Date */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">{t('endDate')}</Label>
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          type="number"
                          placeholder={t('year')}
                          value={editEndYear || ''}
                          onChange={(e) => setEditEndYear(e.target.value ? parseInt(e.target.value) : null)}
                          min={0}
                          max={2100}
                        />
                        <Input
                          type="number"
                          placeholder={t('month')}
                          value={editEndMonth || ''}
                          onChange={(e) => setEditEndMonth(e.target.value ? parseInt(e.target.value) : null)}
                          min={1}
                          max={12}
                        />
                        <Input
                          type="number"
                          placeholder={t('day')}
                          value={editEndDay || ''}
                          onChange={(e) => setEditEndDay(e.target.value ? parseInt(e.target.value) : null)}
                          min={1}
                          max={31}
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={handleUpdate}
                        disabled={isUpdating}
                      >
                        {isUpdating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {t('updating')}
                          </>
                        ) : (
                          <>
                            <Edit className="w-4 h-4 mr-2" />
                            {t('updateDates')}
                          </>
                        )}
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => handleDelete(editingRelationshipId)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {t('deleting')}
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t('deleteRelationship')}
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
