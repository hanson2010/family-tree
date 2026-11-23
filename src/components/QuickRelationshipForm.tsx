'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useLocale } from '@/components/LocaleProvider';
import { PersonAutocomplete } from '@/components/PersonAutocomplete';
import { DateInputs, FormGrid, RowLabel } from '@/components/FormLayout';
import { familyHints } from '@/lib/candidates';
import type { RelationshipFormData, Person } from '@/types';
import { RelationshipType as RelType, Gender as GenderEnum } from '@/types';
import { Loader2, Users } from 'lucide-react';

interface QuickRelationshipFormProps {
  isOpen: boolean;
  persons: Person[];
  /** Ids of persons in at least one relationship; the others are suggested first */
  linkedIds: Set<string>;
  onSubmit: (data: RelationshipFormData) => Promise<void>;
  onClose: () => void;
}

export function QuickRelationshipForm({
  isOpen,
  persons,
  linkedIds,
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

  const find = (id: string) => persons.find((p) => p.id === id);
  const hints = familyHints(find(dadId), find(momId), find(childId));

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

          <FormGrid>
            <PersonAutocomplete
              inline
              value={dadId}
              onChange={setDadId}
              persons={persons}
              linkedIds={linkedIds}
              hint={hints.father}
              excludeIds={[momId, childId].filter(Boolean)}
              placeholder={t('searchByName')}
              label={t('father')}
              genderFilter={GenderEnum.MALE}
            />
            <PersonAutocomplete
              inline
              value={momId}
              onChange={setMomId}
              persons={persons}
              linkedIds={linkedIds}
              hint={hints.mother}
              excludeIds={[dadId, childId].filter(Boolean)}
              placeholder={t('searchByName')}
              label={t('mother')}
              genderFilter={GenderEnum.FEMALE}
            />
            <PersonAutocomplete
              inline
              value={childId}
              onChange={setChildId}
              persons={persons}
              linkedIds={linkedIds}
              hint={hints.child}
              excludeIds={[dadId, momId].filter(Boolean)}
              placeholder={t('searchByName')}
              label={t('child')}
            />

            {/* Marriage dates */}
            <p className="col-span-2 border-t pt-3 text-sm font-medium">{t('marriageDateOptional')}</p>
            <RowLabel htmlFor="marriage-start">{t('startDate')}</RowLabel>
            <DateInputs
              id="marriage-start"
              value={{ year: marriageStartYear, month: marriageStartMonth, day: marriageStartDay }}
              onChange={(part, value) =>
                ({ year: setMarriageStartYear, month: setMarriageStartMonth, day: setMarriageStartDay })[part](value)
              }
              disabled={isSubmitting}
            />
            <RowLabel htmlFor="marriage-end">{t('endDate')}</RowLabel>
            <DateInputs
              id="marriage-end"
              value={{ year: marriageEndYear, month: marriageEndMonth, day: marriageEndDay }}
              onChange={(part, value) =>
                ({ year: setMarriageEndYear, month: setMarriageEndMonth, day: setMarriageEndDay })[part](value)
              }
              disabled={isSubmitting}
            />
          </FormGrid>

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
