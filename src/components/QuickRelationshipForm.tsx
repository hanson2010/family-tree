'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useLocale } from '@/components/LocaleProvider';
import { PersonAutocomplete } from '@/components/PersonAutocomplete';
import { DateInputs, FormGrid, RowLabel, RowNote } from '@/components/FormLayout';
import { familyHints } from '@/lib/candidates';
import type { ImportCommit, ImportRef, ImportResult } from '@/lib/import';
import type { ApiResponse, Person } from '@/types';
import { RelationshipType, Gender } from '@/types';
import { Loader2, Users } from 'lucide-react';

interface QuickRelationshipFormProps {
  isOpen: boolean;
  persons: Person[];
  /** Ids of persons in at least one relationship; the others are suggested first */
  linkedIds: Set<string>;
  /** Called after the family is saved */
  onSaved: () => void;
  onClose: () => void;
}

/** One person of the family: a chosen person, or a typed name */
interface Row {
  id: string;
  text: string;
  /** For a new child */
  gender: Gender;
  /** For a child: optional birth date */
  birth: DateParts;
}

type DateParts = { year: number | null; month: number | null; day: number | null };
const noDate = (): DateParts => ({ year: null, month: null, day: null });

const SLOTS = ['father', 'mother', 'child1', 'child2', 'child3'] as const;
type Slot = (typeof SLOTS)[number];
const CHILDREN: Slot[] = ['child1', 'child2', 'child3'];
const emptyRows = (): Record<Slot, Row> =>
  Object.fromEntries(SLOTS.map((slot) => [slot, { id: '', text: '', gender: Gender.UNKNOWN, birth: noDate() }])) as Record<
    Slot,
    Row
  >;

/** What a row stands for: nothing, a person in the tree, a new person, or a name several persons have */
type Resolved =
  | { kind: 'empty' }
  | { kind: 'existing'; person: Person; byName: boolean }
  | { kind: 'new'; name: string }
  | { kind: 'ambiguous'; name: string };

/**
 * Add a family at once: two parents and up to three children, as persons chosen from the tree or
 * new names. A typed name that exactly one person of that gender (and, when given, birth year) in
 * the tree has is that person, not a new one. The parents are married, each child is the child of each parent; relationships
 * that exist already are skipped. Saved in one step through the import.
 */
export function QuickRelationshipForm({ isOpen, persons, linkedIds, onSaved, onClose }: QuickRelationshipFormProps) {
  const { toast } = useToast();
  const { t } = useLocale();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rows, setRows] = useState(emptyRows);
  const [marriage, setMarriage] = useState(noDate);
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRows(emptyRows());
      setMarriage(noDate());
    }
  }, [isOpen]);

  const update = (slot: Slot, change: Partial<Row>) => setRows((all) => ({ ...all, [slot]: { ...all[slot], ...change } }));
  const find = (id: string) => persons.find((p) => p.id === id);
  const fixedGender = (slot: Slot) => (slot === 'father' ? Gender.MALE : slot === 'mother' ? Gender.FEMALE : undefined);

  const resolve = (slot: Slot): Resolved => {
    const row = rows[slot];
    const chosen = row.id ? find(row.id) : undefined;
    if (chosen) return { kind: 'existing', person: chosen, byName: false };
    const name = row.text.trim();
    if (!name) return { kind: 'empty' };
    const gender = fixedGender(slot) ?? (row.gender === Gender.UNKNOWN ? undefined : row.gender);
    const year = row.birth.year;
    const same = persons.filter(
      (p) =>
        p.name.trim() === name &&
        (!gender || p.gender === gender) &&
        (year == null || p.birthYear == null || p.birthYear === year)
    );
    if (same.length === 1) return { kind: 'existing', person: same[0], byName: true };
    if (same.length > 1) return { kind: 'ambiguous', name };
    return { kind: 'new', name };
  };
  const resolved = Object.fromEntries(SLOTS.map((slot) => [slot, resolve(slot)])) as Record<Slot, Resolved>;
  const personOf = (slot: Slot) => {
    const r = resolved[slot];
    return r.kind === 'existing' ? r.person : undefined;
  };
  const hints = familyHints(personOf('father'), personOf('mother'), personOf('child1'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const filled = SLOTS.filter((slot) => resolved[slot].kind !== 'empty');
    const parents = filled.filter((slot) => slot === 'father' || slot === 'mother');
    const children = filled.filter((slot) => CHILDREN.includes(slot));
    const fail = (description: string) => toast({ variant: 'destructive', title: t('validationError'), description });

    if (parents.length === 0 || (parents.length === 1 && children.length === 0)) return fail(t('familyNeedsTwo'));
    const ambiguous = filled.find((slot) => resolved[slot].kind === 'ambiguous');
    if (ambiguous) return fail(t('familyAmbiguousName').replace('{name}', (resolved[ambiguous] as { name: string }).name));
    const ids = filled.map((slot) => personOf(slot)?.id).filter(Boolean);
    if (new Set(ids).size !== ids.length) return fail(t('duplicatePersonSelection'));

    // Persons to create, and how relationships refer to each slot
    const newPersons: ImportCommit['persons'] = [];
    const ref = (slot: Slot): ImportRef => {
      const r = resolved[slot];
      return r.kind === 'existing' ? { id: r.person.id } : { key: slot };
    };
    for (const slot of filled) {
      const r = resolved[slot];
      if (r.kind !== 'new') continue;
      const { year, month, day } = rows[slot].birth;
      newPersons.push({
        key: slot,
        name: r.name,
        otherNames: undefined,
        gender: fixedGender(slot) ?? rows[slot].gender,
        birthYear: year,
        birthMonth: month,
        birthDay: day,
      });
    }
    const relationships: ImportCommit['relationships'] = [];
    if (parents.length === 2) {
      relationships.push({
        a: ref('mother'),
        b: ref('father'),
        type: RelationshipType.SPOUSE,
        startYear: marriage.year,
        startMonth: marriage.month,
        startDay: marriage.day,
      });
    }
    for (const child of children) {
      for (const parent of parents) relationships.push({ a: ref(parent), b: ref(child), type: RelationshipType.PARENT_CHILD });
    }

    setIsSubmitting(true);
    try {
      const body: ImportCommit = { isPrivate, persons: newPersons, relationships };
      const response = await fetch('/api/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result: ApiResponse<ImportResult> = await response.json();
      if (!response.ok || !result.success || !result.data) throw new Error(result.error || t('failedToSave'));
      toast({
        title: t('familyAdded'),
        description: t('familyAddedDetail')
          .replace('{persons}', String(result.data.personsCreated))
          .replace('{relationships}', String(result.data.relationshipsCreated)),
      });
      onSaved();
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

  const labels: Record<Slot, string> = {
    father: t('father'),
    mother: t('mother'),
    child1: `${t('child')} 1`,
    child2: `${t('child')} 2`,
    child3: `${t('child')} 3`,
  };

  /** Under a row: whether it is a person in the tree or a new one */
  const status = (slot: Slot) => {
    const r = resolved[slot];
    if (r.kind === 'existing' && r.byName) return <RowNote>{t('familyExisting')}</RowNote>;
    if (r.kind === 'ambiguous') return <RowNote>{t('familyAmbiguousName').replace('{name}', r.name)}</RowNote>;
    if (r.kind === 'new') return <RowNote>{t('familyNew')}</RowNote>;
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="form">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('quickAddRelationshipTitle')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('quickAddRelationshipDesc')}</p>

          <FormGrid>
            {SLOTS.map((slot) => {
              const isChild = CHILDREN.includes(slot);
              const others = SLOTS.filter((s) => s !== slot)
                .map((s) => rows[s].id)
                .filter(Boolean);
              const box = (
                <PersonAutocomplete
                  inline={!isChild}
                  labelHidden={isChild}
                  clearable
                  label={labels[slot]}
                  value={rows[slot].id}
                  onChange={(id) => update(slot, { id })}
                  allowNew={{ text: rows[slot].text, onTextChange: (text) => update(slot, { text }) }}
                  persons={persons}
                  linkedIds={linkedIds}
                  hint={slot === 'father' ? hints.father : slot === 'mother' ? hints.mother : hints.child}
                  genderFilter={fixedGender(slot)}
                  excludeIds={others}
                  placeholder={t('familyNamePlaceholder')}
                  disabled={isSubmitting}
                  className={isChild ? 'min-w-0 flex-1' : undefined}
                />
              );
              return (
                <React.Fragment key={slot}>
                  {isChild ? (
                    <>
                      <RowLabel>{labels[slot]}</RowLabel>
                      <div className="flex items-center gap-2">
                        {box}
                        {resolved[slot].kind === 'new' && (
                          <select
                            aria-label={t('gender')}
                            value={rows[slot].gender}
                            onChange={(e) => update(slot, { gender: e.target.value as Gender })}
                            disabled={isSubmitting}
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                          >
                            <option value={Gender.UNKNOWN}>{t('unknown')}</option>
                            <option value={Gender.MALE}>{t('male')}</option>
                            <option value={Gender.FEMALE}>{t('female')}</option>
                          </select>
                        )}
                      </div>
                    </>
                  ) : (
                    box
                  )}
                  {status(slot)}
                  {isChild && !rows[slot].id && rows[slot].text.trim() && (
                    <>
                      <RowLabel htmlFor={`${slot}-birth`}>{t('birthDate')}</RowLabel>
                      <DateInputs
                        id={`${slot}-birth`}
                        value={rows[slot].birth}
                        onChange={(part, value) => update(slot, { birth: { ...rows[slot].birth, [part]: value } })}
                        disabled={isSubmitting}
                      />
                    </>
                  )}
                  {/* The parents' marriage, between them and the children */}
                  {slot === 'mother' && (
                    <>
                      <RowLabel htmlFor="marriage-date">{t('marriageDate')}</RowLabel>
                      <DateInputs
                        id="marriage-date"
                        value={marriage}
                        onChange={(part, value) => setMarriage((date) => ({ ...date, [part]: value }))}
                        disabled={isSubmitting}
                      />
                    </>
                  )}
                </React.Fragment>
              );
            })}
          </FormGrid>

          <div className="flex items-center gap-2">
            <Switch id="family-private" checked={isPrivate} onCheckedChange={setIsPrivate} disabled={isSubmitting} />
            <Label htmlFor="family-private">{t('familyPrivate')}</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
