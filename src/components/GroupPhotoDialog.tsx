'use client';

import * as React from 'react';
import { useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useLocale } from '@/components/LocaleProvider';
import { GEMINI_ISSUE_KEYS } from '@/lib/i18n';
import type { GeminiIssue } from '@/types';
import type { ApiResponse, AvatarUploadResponse, Person, PersonFormData } from '@/types';

const fieldClass =
  'h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

interface GroupPhotoDialogProps {
  isOpen: boolean;
  /** Persons the user created; only they can be given an avatar */
  persons: Person[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

export function GroupPhotoDialog({ isOpen, persons, onClose, onSaved }: GroupPhotoDialogProps) {
  const { t } = useLocale();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [faces, setFaces] = useState<string[]>([]);
  const [detected, setDetected] = useState(true);
  // Why faces could not be looked for, when Gemini failed
  const [issue, setIssue] = useState<GeminiIssue | null>(null);
  // Person id chosen for each face; '' means the face is not used
  const [assigned, setAssigned] = useState<string[]>([]);
  const [isWorking, setIsWorking] = useState(false);
  const [keepUnused, setKeepUnused] = useState(true);

  const reset = () => {
    setFaces([]);
    setAssigned([]);
    setDetected(true);
    setIssue(null);
    setKeepUnused(true);
  };

  const close = () => {
    if (isWorking) return;
    reset();
    onClose();
  };

  const upload = async (file: File) => {
    setIsWorking(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await fetch('/api/avatar', { method: 'POST', body: form });
      const result: AvatarUploadResponse & { error?: string } = await response.json();
      if (!result.success) throw new Error(result.error || t('avatarUploadFailed'));
      setFaces(result.avatars);
      setDetected(result.detected);
      setIssue(result.geminiIssue ?? null);
      setAssigned(result.avatars.map(() => ''));
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error instanceof Error ? error.message : t('avatarUploadFailed'),
      });
    } finally {
      setIsWorking(false);
    }
  };

  const save = async () => {
    setIsWorking(true);
    try {
      const updates = assigned.flatMap((id, i) => {
        const person = persons.find((p) => p.id === id);
        return person ? [{ person, avatar: faces[i] }] : [];
      });
      for (const { person, avatar } of updates) {
        const data: PersonFormData = {
          name: person.name,
          courtesyName: person.courtesyName,
          artName: person.artName,
          gender: person.gender,
          birthYear: person.birthYear ?? null,
          birthMonth: person.birthMonth ?? null,
          birthDay: person.birthDay ?? null,
          deathYear: person.deathYear ?? null,
          deathMonth: person.deathMonth ?? null,
          deathDay: person.deathDay ?? null,
          avatar,
          isPrivate: person.isPrivate,
        };
        const response = await fetch(`/api/persons/${person.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const result: ApiResponse<Person> = await response.json();
        if (!result.success) throw new Error(`${person.name}: ${result.error || t('failedToSave')}`);
      }
      const unused = faces.filter((_, i) => !assigned[i]);
      if (keepUnused && unused.length > 0) {
        const response = await fetch('/api/avatars', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images: unused }),
        });
        const result: ApiResponse<unknown> = await response.json();
        if (!result.success) throw new Error(result.error || t('failedToSave'));
      }
      toast({
        title: t('avatarsSaved'),
        description: [
          updates.map((u) => u.person.name).join('、'),
          keepUnused && unused.length > 0 ? `${t('facesSavedForLater')}: ${unused.length}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
      });
      await onSaved();
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

  const sortedPersons = [...persons].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
  const chosen = assigned.filter(Boolean);
  const hasRepeat = new Set(chosen).size !== chosen.length;
  const unusedCount = faces.length - chosen.length;
  const canSave = !hasRepeat && (chosen.length > 0 || (keepUnused && unusedCount > 0));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('groupPhoto')}</DialogTitle>
          <DialogDescription>{t('groupPhotoDescription')}</DialogDescription>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = '';
          }}
        />
        <Button type="button" variant="outline" disabled={isWorking} onClick={() => fileInputRef.current?.click()}>
          {isWorking && faces.length === 0 ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          {isWorking && faces.length === 0 ? t('detectingFaces') : t('uploadPhoto')}
        </Button>

        {faces.length > 0 && (
          <>
            {issue ? (
              <p className="text-sm text-destructive">
                {t('facesNotDetected')}: {t(GEMINI_ISSUE_KEYS[issue])}
              </p>
            ) : (
              !detected && <p className="text-sm text-muted-foreground">{t('noFaceFound')}</p>
            )}
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {faces.map((face, i) => (
                <li key={i} className="flex flex-col items-center gap-2 rounded-lg border bg-background p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={face} alt="" className="h-20 w-20 rounded-full object-cover" />
                  <select
                    aria-label={`${t('assignPerson')} ${i + 1}`}
                    value={assigned[i] ?? ''}
                    onChange={(e) => setAssigned((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                    className={fieldClass}
                  >
                    <option value="">{t('notAssigned')}</option>
                    {sortedPersons.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.birthYear ? ` (${p.birthYear})` : ''}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            {hasRepeat && <p className="text-sm text-destructive">{t('faceAssignedTwice')}</p>}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={keepUnused}
                onChange={(e) => setKeepUnused(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              {t('keepUnusedFaces')} ({unusedCount})
            </label>
          </>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={isWorking} onClick={close}>
            {t('cancel')}
          </Button>
          <Button type="button" disabled={isWorking || !canSave} onClick={save}>
            {isWorking && faces.length > 0 && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('save')} ({chosen.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
