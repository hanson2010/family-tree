'use client';

import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useLocale } from '@/components/LocaleProvider';
import { PersonAutocomplete } from '@/components/PersonAutocomplete';
import { PersonAvatar } from '@/components/PersonAvatar';
import { planMerge } from '@/lib/merge';
import type { TranslationKey } from '@/lib/i18n';
import type { ApiResponse, Person, Relationship } from '@/types';
import { Gender } from '@/types';
import { cn } from '@/lib/utils';

type Side = 'this' | 'other';
type Field = 'name' | 'courtesyName' | 'artName' | 'gender' | 'birth' | 'death' | 'avatar' | 'isPrivate';

const FIELDS: { field: Field; label: TranslationKey }[] = [
  { field: 'name', label: 'name' },
  { field: 'courtesyName', label: 'courtesyName' },
  { field: 'artName', label: 'artName' },
  { field: 'gender', label: 'gender' },
  { field: 'birth', label: 'birthDate' },
  { field: 'death', label: 'deathDate' },
  { field: 'avatar', label: 'avatar' },
  { field: 'isPrivate', label: 'isPrivate' },
];

const date = (y?: number | null, m?: number | null, d?: number | null) => [y, m, d].filter((v) => v != null).join('-');

/** A field's value for comparing and display; '' means not recorded */
function valueOf(p: Person, field: Field): string {
  switch (field) {
    case 'birth':
      return date(p.birthYear, p.birthMonth, p.birthDay);
    case 'death':
      return date(p.deathYear, p.deathMonth, p.deathDay);
    case 'avatar':
      return p.avatar ?? '';
    case 'isPrivate':
      return p.isPrivate ? 'yes' : 'no';
    case 'gender':
      return p.gender === Gender.UNKNOWN ? '' : p.gender;
    default:
      return p[field]?.trim() ?? '';
  }
}

interface MergePersonDialogProps {
  isOpen: boolean;
  /** The person kept; the other one is merged into it and deleted */
  person: Person | null;
  /** Persons that can be merged in: the user's own */
  candidates: Person[];
  linkedIds: Set<string>;
  relationships: Relationship[];
  onClose: () => void;
  onMerged: (keptId: string) => Promise<void> | void;
}

export function MergePersonDialog({ isOpen, person, candidates, linkedIds, relationships, onClose, onMerged }: MergePersonDialogProps) {
  const { t } = useLocale();
  const { toast } = useToast();
  const [otherId, setOtherId] = useState('');
  const [choice, setChoice] = useState<Partial<Record<Field, Side>>>({});
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setOtherId('');
      setChoice({});
    }
  }, [isOpen, person?.id]);

  const other = candidates.find((p) => p.id === otherId) ?? null;

  // Fields where the two differ; by default the kept person's value, unless it is not recorded
  const differing = useMemo(
    () => (person && other ? FIELDS.filter(({ field }) => valueOf(person, field) !== valueOf(other, field)) : []),
    [person, other]
  );
  const sideOf = (field: Field): Side =>
    choice[field] ?? (person && !valueOf(person, field) && other && valueOf(other, field) ? 'other' : 'this');

  const plan = useMemo(() => {
    if (!person || !other) return null;
    const theirs = relationships.filter((r) => [r.personAId, r.personBId].some((id) => id === person.id || id === other.id));
    return planMerge(person.id, other.id, theirs);
  }, [person, other, relationships]);

  if (!person) return null;

  const pick = (field: Field) => (sideOf(field) === 'this' || !other ? person : other);

  const merge = async () => {
    if (!other) return;
    setIsWorking(true);
    try {
      const birth = pick('birth');
      const death = pick('death');
      const body = {
        otherId: other.id,
        person: {
          name: pick('name').name,
          courtesyName: pick('courtesyName').courtesyName ?? '',
          artName: pick('artName').artName ?? '',
          gender: pick('gender').gender,
          birthYear: birth.birthYear ?? null,
          birthMonth: birth.birthMonth ?? null,
          birthDay: birth.birthDay ?? null,
          deathYear: death.deathYear ?? null,
          deathMonth: death.deathMonth ?? null,
          deathDay: death.deathDay ?? null,
          isPrivate: pick('isPrivate').isPrivate,
        },
        avatarFrom: pick('avatar').avatar ? sideOf('avatar') : 'none',
      };
      const response = await fetch(`/api/persons/${person.id}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result: ApiResponse<Person> = await response.json();
      if (!result.success) throw new Error(result.error || t('failedToSave'));
      toast({ title: t('personsMerged'), description: `${other.name} → ${body.person.name}` });
      await onMerged(person.id);
      onClose();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error instanceof Error ? error.message : t('failedToSave'),
      });
    } finally {
      setIsWorking(false);
    }
  };

  const show = (p: Person, field: Field) => {
    if (field === 'avatar') return <PersonAvatar person={p} className="h-8 w-8" />;
    if (field === 'gender') return p.gender === Gender.MALE ? t('male') : p.gender === Gender.FEMALE ? t('female') : t('unknown');
    if (field === 'isPrivate') return p.isPrivate ? t('private') : '—';
    return valueOf(p, field) || '—';
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isWorking && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('mergePerson')}</DialogTitle>
          <DialogDescription>{t('mergeDescription').replaceAll('{name}', person.name)}</DialogDescription>
        </DialogHeader>

        <PersonAutocomplete
          value={otherId}
          onChange={setOtherId}
          persons={candidates}
          linkedIds={linkedIds}
          hint={{ gender: person.gender === Gender.UNKNOWN ? undefined : person.gender }}
          excludeIds={[person.id]}
          placeholder={t('searchByName')}
          label={t('mergeWith')}
        />

        {other && (
          <div className="space-y-3">
            {differing.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('mergeSameDetails')}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-1 font-normal" />
                    <th className="py-1 font-medium">{person.name}</th>
                    <th className="py-1 font-medium">{other.name}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {differing.map(({ field, label }) => (
                    <tr key={field}>
                      <td className="py-2 pr-2 text-muted-foreground">{t(label)}</td>
                      {(['this', 'other'] as const).map((side) => (
                        <td key={side} className="py-2 pr-2">
                          <label
                            className={cn(
                              'flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1',
                              sideOf(field) === side ? 'border-primary bg-primary/5' : 'border-transparent'
                            )}
                          >
                            <input
                              type="radio"
                              name={`merge-${field}`}
                              checked={sideOf(field) === side}
                              onChange={() => setChoice((c) => ({ ...c, [field]: side }))}
                              className="accent-primary"
                            />
                            <span className="min-w-0 break-words">{show(side === 'this' ? person : other, field)}</span>
                          </label>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {plan && (
              <p className="text-sm text-muted-foreground">
                {t('mergeRelationshipsMoved')}: {plan.moved.length} · {t('mergeRelationshipsDropped')}: {plan.dropped.length}
              </p>
            )}
            <p className="text-sm text-destructive">{t('mergeWarning').replaceAll('{name}', other.name)}</p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={isWorking} onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="button" variant="destructive" disabled={isWorking || !other} onClick={merge}>
            {isWorking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('merge')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
