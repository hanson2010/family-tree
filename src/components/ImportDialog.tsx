'use client';

import * as React from 'react';
import { useRef, useState } from 'react';
import { FileText, Loader2, Paperclip, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { useLocale } from '@/components/LocaleProvider';
import { GEMINI_ISSUE_KEYS, type TranslationKey } from '@/lib/i18n';
import {
  buildCommit,
  toReview,
  type Extraction,
  type ImportResult,
  type ReviewPerson,
  type ReviewRelationship,
} from '@/lib/import';
import type { ApiResponse, Person } from '@/types';
import { Gender, RelationshipType } from '@/types';
import { cn } from '@/lib/utils';

const MAX_FILES = 6;

const TYPE_LABELS: Record<RelationshipType, TranslationKey> = {
  [RelationshipType.PARENT_CHILD]: 'parentChild',
  [RelationshipType.SIBLING]: 'sibling',
  [RelationshipType.HALF_SIBLING]: 'halfSibling',
  [RelationshipType.SPOUSE]: 'spouse',
  [RelationshipType.CONCUBINE]: 'concubine',
  [RelationshipType.BETROTHED]: 'betrothed',
  [RelationshipType.ADOPTIVE_PARENT]: 'adoptiveParent',
  [RelationshipType.FOSTER_PARENT]: 'fosterParent',
  [RelationshipType.SWORN_SIBLING]: 'swornSibling',
};

const fieldClass =
  'h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';

interface ImportDialogProps {
  isOpen: boolean;
  /** Persons the user can see, to link imported persons to */
  persons: Person[];
  onClose: () => void;
  onImported: () => Promise<void> | void;
}

export function ImportDialog({ isOpen, persons, onClose, onImported }: ImportDialogProps) {
  const { t } = useLocale();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isWorking, setIsWorking] = useState(false);
  const [review, setReview] = useState<{ persons: ReviewPerson[]; relationships: ReviewRelationship[] } | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);

  const reset = () => {
    setText('');
    setFiles([]);
    setReview(null);
    setIsPrivate(false);
  };

  const close = () => {
    if (isWorking) return;
    reset();
    onClose();
  };

  const extract = async () => {
    setIsWorking(true);
    try {
      const form = new FormData();
      form.append('text', text);
      files.forEach((f) => form.append('files', f));
      const response = await fetch('/api/import/extract', { method: 'POST', body: form });
      const result: ApiResponse<Extraction> = await response.json();
      if (result.geminiIssue) throw new Error(t(GEMINI_ISSUE_KEYS[result.geminiIssue]));
      if (!result.success || !result.data) throw new Error(result.error || t('extractFailed'));
      if (result.data.persons.length === 0) {
        toast({ variant: 'destructive', title: t('nothingFound') });
        return;
      }
      setReview(toReview(result.data, persons));
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('extractFailed'),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsWorking(false);
    }
  };

  const commit = review ? buildCommit(review.persons, review.relationships, isPrivate) : null;

  const save = async () => {
    if (!commit) return;
    setIsWorking(true);
    try {
      const response = await fetch('/api/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commit),
      });
      const result: ApiResponse<ImportResult> = await response.json();
      if (!result.success || !result.data) throw new Error(result.error || t('failedToSave'));
      toast({
        title: t('importDone'),
        description: `${t('newPersons')}: ${result.data.personsCreated} · ${t('relationshipsLabel')}: ${result.data.relationshipsCreated}`,
      });
      await onImported();
      reset();
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

  const updatePerson = (key: string, change: Partial<ReviewPerson>) =>
    setReview((r) => r && { ...r, persons: r.persons.map((p) => (p.key === key ? { ...p, ...change } : p)) });
  const toggleRelationship = (index: number, include: boolean) =>
    setReview((r) => r && { ...r, relationships: r.relationships.map((x, i) => (i === index ? { ...x, include } : x)) });

  const nameOf = (key: string) => review?.persons.find((p) => p.key === key)?.name || key;
  const isIncluded = (key: string) => !!review?.persons.find((p) => p.key === key && p.include && p.name.trim());
  const sortedPersons = [...persons].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
  const numberValue = (v: string) => (v.trim() === '' ? null : Number.parseInt(v, 10) || null);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('importRecords')}</DialogTitle>
          <DialogDescription>{review ? t('importReviewHint') : t('importDescription')}</DialogDescription>
        </DialogHeader>

        {!review ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="import-text">{t('importText')}</Label>
              <textarea
                id="import-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t('importTextPlaceholder')}
                rows={8}
                maxLength={30000}
                disabled={isWorking}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <Label>{t('importFiles')}</Label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const chosen = Array.from(e.target.files ?? []);
                  setFiles((prev) => [...prev, ...chosen].slice(0, MAX_FILES));
                  e.target.value = '';
                }}
              />
              {files.length > 0 && (
                <ul className="space-y-1">
                  {files.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-sm">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{f.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {(f.size / 1024 / 1024).toFixed(1)} MB
                      </span>
                      <button
                        type="button"
                        aria-label={t('delete')}
                        disabled={isWorking}
                        onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={isWorking || files.length >= MAX_FILES}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="mr-2 h-4 w-4" />
                {t('addFiles')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">
                {t('personsLabel')} ({review.persons.filter((p) => p.include).length}/{review.persons.length})
              </h3>
              <ul className="space-y-2">
                {review.persons.map((p) => {
                  const isNew = p.match === 'new';
                  const editable = p.include && isNew;
                  return (
                    <li key={p.key} className={cn('rounded-lg border bg-background p-3', !p.include && 'opacity-50')}>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="checkbox"
                          aria-label={t('includeItem')}
                          checked={p.include}
                          onChange={(e) => updatePerson(p.key, { include: e.target.checked })}
                          className="h-4 w-4 accent-primary"
                        />
                        <Input
                          aria-label={t('name')}
                          value={p.name}
                          disabled={!editable}
                          onChange={(e) => updatePerson(p.key, { name: e.target.value })}
                          className="h-9 w-32"
                        />
                        <select
                          aria-label={t('gender')}
                          value={p.gender}
                          disabled={!editable}
                          onChange={(e) => updatePerson(p.key, { gender: e.target.value as Gender })}
                          className={fieldClass}
                        >
                          <option value={Gender.MALE}>{t('male')}</option>
                          <option value={Gender.FEMALE}>{t('female')}</option>
                          <option value={Gender.UNKNOWN}>{t('unknown')}</option>
                        </select>
                        <select
                          aria-label={t('matchLabel')}
                          value={p.match}
                          disabled={!p.include}
                          onChange={(e) => updatePerson(p.key, { match: e.target.value })}
                          // Its own line on narrow screens, the rest of the row on wider ones
                          className={cn(fieldClass, 'min-w-0 basis-full sm:basis-auto sm:flex-1')}
                        >
                          <option value="new">{t('matchNew')}</option>
                          {sortedPersons.map((existing) => (
                            <option key={existing.id} value={existing.id}>
                              {t('matchExisting')}
                              {existing.name}
                              {existing.birthYear ? ` (${existing.birthYear})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {isNew && (
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <Input
                            aria-label={t('courtesyName')}
                            placeholder={t('courtesyName')}
                            value={p.courtesyName ?? ''}
                            disabled={!editable}
                            onChange={(e) => updatePerson(p.key, { courtesyName: e.target.value })}
                            className="h-9"
                          />
                          <Input
                            aria-label={t('artName')}
                            placeholder={t('artName')}
                            value={p.artName ?? ''}
                            disabled={!editable}
                            onChange={(e) => updatePerson(p.key, { artName: e.target.value })}
                            className="h-9"
                          />
                          {(['birth', 'death'] as const).map((which) => (
                            <div key={which} className="flex min-w-0 items-center gap-1">
                              <span className="w-16 shrink-0 text-xs text-muted-foreground">
                                {t(which === 'birth' ? 'birthDate' : 'deathDate')}
                              </span>
                              {(['Year', 'Month', 'Day'] as const).map((part) => {
                                const field = `${which}${part}` as const;
                                return (
                                  <input
                                    key={field}
                                    type="number"
                                    inputMode="numeric"
                                    aria-label={`${t(which === 'birth' ? 'birthDate' : 'deathDate')} ${t(part === 'Year' ? 'year' : part === 'Month' ? 'month' : 'day')}`}
                                    placeholder={t(part === 'Year' ? 'year' : part === 'Month' ? 'month' : 'day')}
                                    value={p[field] ?? ''}
                                    disabled={!editable}
                                    onChange={(e) => updatePerson(p.key, { [field]: numberValue(e.target.value) })}
                                    className={cn(
                                      fieldClass,
                                      // The boxes share the cell's width, the year a little more
                                      part === 'Year' ? 'flex-[1.6]' : 'flex-1',
                                      'w-0 min-w-0 px-1.5 tabular-nums'
                                    )}
                                  />
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      )}

                      {p.note && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {t('sourceNote')}: {p.note}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">
                {t('relationshipsLabel')} ({commit?.relationships.length ?? 0}/{review.relationships.length})
              </h3>
              {review.relationships.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noRelationships')}</p>
              ) : (
                <ul className="space-y-1">
                  {review.relationships.map((r, i) => {
                    const usable = isIncluded(r.personAKey) && isIncluded(r.personBKey);
                    return (
                      <li key={i} className={cn('flex items-center gap-2 text-sm', (!r.include || !usable) && 'opacity-50')}>
                        <input
                          type="checkbox"
                          aria-label={t('includeItem')}
                          checked={r.include && usable}
                          disabled={!usable}
                          onChange={(e) => toggleRelationship(i, e.target.checked)}
                          className="h-4 w-4 accent-primary"
                        />
                        <span className="font-medium">{nameOf(r.personAKey)}</span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{t(TYPE_LABELS[r.type])}</span>
                        <span className="font-medium">{nameOf(r.personBKey)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <div className="flex items-center gap-2">
              <Switch id="import-private" checked={isPrivate} onCheckedChange={setIsPrivate} />
              <Label htmlFor="import-private" className="text-sm">
                {t('importAsPrivate')}
              </Label>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {review ? (
            <>
              <Button type="button" variant="outline" disabled={isWorking} onClick={() => setReview(null)}>
                {t('back')}
              </Button>
              <Button
                type="button"
                disabled={isWorking || !commit || (commit.persons.length === 0 && commit.relationships.length === 0)}
                onClick={save}
              >
                {isWorking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('importSave')} ({commit?.persons.length ?? 0} + {commit?.relationships.length ?? 0})
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" disabled={isWorking} onClick={close}>
                {t('cancel')}
              </Button>
              <Button type="button" disabled={isWorking || (!text.trim() && files.length === 0)} onClick={extract}>
                {isWorking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isWorking ? t('extracting') : t('extract')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
