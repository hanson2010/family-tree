'use client';

import * as React from 'react';
import { useState, useCallback } from 'react';
import Image from 'next/image';
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useLocale } from '@/components/LocaleProvider';
import type { ApiResponse, Person, PersonFormData, Gender, AvatarUploadResponse, SavedAvatar } from '@/types';
import { Gender as GenderEnum } from '@/types';
import { Upload, X, User, Loader2 } from 'lucide-react';

interface PersonFormProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  person?: Person | null;
  onSubmit: (data: PersonFormData) => Promise<void>;
  onClose: () => void;
}

export function PersonForm({ isOpen, mode, person, onSubmit, onClose }: PersonFormProps) {
  const { toast } = useToast();
  const { t } = useLocale();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  // Faces saved earlier from group photos; the chosen one is removed once the person is saved
  const [savedAvatars, setSavedAvatars] = useState<SavedAvatar[]>([]);
  const [chosenSavedId, setChosenSavedId] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    setChosenSavedId(null);
    let cancelled = false;
    fetch('/api/avatars')
      .then((r) => r.json())
      .then((result: ApiResponse<SavedAvatar[]>) => {
        if (!cancelled && result.success) setSavedAvatars(result.data ?? []);
      })
      .catch(() => {
        // Saved faces are optional; the form works without them
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const deleteSavedAvatar = async (id: string) => {
    const response = await fetch(`/api/avatars/${id}`, { method: 'DELETE' });
    if (response.ok) {
      setSavedAvatars((list) => list.filter((a) => a.id !== id));
      if (chosenSavedId === id) setChosenSavedId(null);
    } else {
      toast({ variant: 'destructive', title: t('error'), description: t('failedToDelete') });
    }
  };
  const [formData, setFormData] = useState<PersonFormData>({
    name: person?.name || '',
    courtesyName: person?.courtesyName || '',
    artName: person?.artName || '',
    gender: person?.gender || GenderEnum.UNKNOWN,
    birthYear: person?.birthYear || null,
    birthMonth: person?.birthMonth || null,
    birthDay: person?.birthDay || null,
    deathYear: person?.deathYear || null,
    deathMonth: person?.deathMonth || null,
    deathDay: person?.deathDay || null,
    avatar: person?.avatar || null,
    isPrivate: person?.isPrivate || false,
  });

  // Reset form when person changes
  React.useEffect(() => {
    if (person) {
      setFormData({
        name: person.name || '',
        courtesyName: person.courtesyName || '',
        artName: person.artName || '',
        gender: person.gender || GenderEnum.UNKNOWN,
        birthYear: person.birthYear || null,
        birthMonth: person.birthMonth || null,
        birthDay: person.birthDay || null,
        deathYear: person.deathYear || null,
        deathMonth: person.deathMonth || null,
        deathDay: person.deathDay || null,
        avatar: person.avatar || null,
        isPrivate: person.isPrivate || false,
      });
    } else {
      setFormData({
        name: '',
        courtesyName: '',
        artName: '',
        gender: GenderEnum.UNKNOWN,
        birthYear: null,
        birthMonth: null,
        birthDay: null,
        deathYear: null,
        deathMonth: null,
        deathDay: null,
        avatar: null,
        isPrivate: false,
      });
    }
  }, [person]);

  const handleInputChange = (field: keyof PersonFormData, value: string | number | null | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAvatarUpload = useCallback(async (file: File) => {
    if (!file) return;

    setIsUploading(true);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const response = await fetch('/api/avatar', {
        method: 'POST',
        body: uploadFormData,
      });

      // The server crops the middle of the photo; faces are looked for only in group photos
      const result: AvatarUploadResponse = await response.json();
      if (result.success && result.avatars.length > 0) {
        setFormData(prev => ({ ...prev, avatar: result.avatars[0] }));
        toast({ title: t('avatarUploaded') });
      } else {
        throw new Error(t('avatarUploadFailed'));
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error instanceof Error ? error.message : t('avatarUploadFailed'),
      });
    } finally {
      setIsUploading(false);
    }
  }, [toast, t]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleAvatarUpload(file);
    }
    e.target.value = '';
  };

  const handleRemoveAvatar = () => {
    setFormData(prev => ({ ...prev, avatar: null }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('nameRequired'),
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // A saved face still shown as the avatar is sent by id; the server saves the person and
      // removes the face from the saved list in one step
      const used = savedAvatars.find((a) => a.id === chosenSavedId && a.image === formData.avatar);
      await onSubmit(used ? { ...formData, savedAvatarId: used.id } : formData);
      if (used) setSavedAvatars((list) => list.filter((a) => a.id !== used.id));
      toast({
        title: mode === 'create' ? t('personCreated') : t('personUpdated'),
        description: formData.name,
      });
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
          <DialogTitle>
            {mode === 'create' ? t('createPerson') : t('editPerson')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar Upload */}
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden">
              {formData.avatar ? (
                <>
                  <Image
                    src={formData.avatar}
                    alt="Avatar"
                    width={80}
                    height={80}
                    unoptimized
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="absolute top-0 right-0 p-1 bg-destructive text-destructive-foreground rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <User className="w-8 h-8 text-muted-foreground" />
              )}
            </div>

            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleFileChange}
                className="hidden"
                disabled={isUploading}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    {t('avatar')}
                  </>
                )}
              </Button>
            </div>
          </div>

          {savedAvatars.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {t('savedFaces')} ({savedAvatars.length})
              </p>
              {/* Newest first; about three rows show, the rest scroll vertically */}
              <div className="flex max-h-[11.5rem] flex-wrap gap-2.5 overflow-y-auto p-1">
                {savedAvatars.map((saved) => (
                  <div key={saved.id} className="relative shrink-0">
                    <button
                      type="button"
                      aria-label={t('useSavedFace')}
                      onClick={() => {
                        setFormData(prev => ({ ...prev, avatar: saved.image }));
                        setChosenSavedId(saved.id);
                      }}
                      className={`h-12 w-12 overflow-hidden rounded-full border-2 transition hover:border-primary focus-visible:border-primary focus-visible:outline-none ${
                        chosenSavedId === saved.id ? 'border-primary' : 'border-transparent'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={saved.image} alt="" className="h-full w-full object-cover" />
                    </button>
                    <button
                      type="button"
                      aria-label={t('deleteSavedFace')}
                      onClick={() => deleteSavedAvatar(saved.id)}
                      className="absolute -right-1 -top-1 rounded-full bg-background p-0.5 text-muted-foreground shadow hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">{t('name')} *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder={t('name')}
            />
          </div>

          {/* Courtesy Name and Art Name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="courtesyName">{t('courtesyName')}</Label>
              <Input
                id="courtesyName"
                value={formData.courtesyName || ''}
                onChange={(e) => handleInputChange('courtesyName', e.target.value)}
                placeholder={t('courtesyName')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="artName">{t('artName')}</Label>
              <Input
                id="artName"
                value={formData.artName || ''}
                onChange={(e) => handleInputChange('artName', e.target.value)}
                placeholder={t('artName')}
              />
            </div>
          </div>

          {/* Gender and Privacy */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('gender')} *</Label>
              <Select
                value={formData.gender}
                onValueChange={(value) => handleInputChange('gender', value as Gender)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('gender')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GenderEnum.MALE}>{t('male')}</SelectItem>
                  <SelectItem value={GenderEnum.FEMALE}>{t('female')}</SelectItem>
                  <SelectItem value={GenderEnum.UNKNOWN}>{t('unknown')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('isPrivate')}</Label>
              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="isPrivate"
                  checked={formData.isPrivate}
                  onCheckedChange={(checked) => handleInputChange('isPrivate', checked)}
                />
                <Label htmlFor="isPrivate" className="text-sm">
                  {t('isPrivate')}
                </Label>
              </div>
            </div>
          </div>

          {/* Birth Date */}
          <div className="space-y-2">
            <Label>{t('birthDate')}</Label>
            <div className="grid grid-cols-3 gap-2">
              <Input
                type="number"
                placeholder={t('year')}
                value={formData.birthYear || ''}
                onChange={(e) => handleInputChange('birthYear', e.target.value ? parseInt(e.target.value) : null)}
                min={0}
                max={2100}
              />
              <Input
                type="number"
                placeholder={t('month')}
                value={formData.birthMonth || ''}
                onChange={(e) => handleInputChange('birthMonth', e.target.value ? parseInt(e.target.value) : null)}
                min={1}
                max={12}
              />
              <Input
                type="number"
                placeholder={t('day')}
                value={formData.birthDay || ''}
                onChange={(e) => handleInputChange('birthDay', e.target.value ? parseInt(e.target.value) : null)}
                min={1}
                max={31}
              />
            </div>
          </div>

          {/* Death Date */}
          <div className="space-y-2">
            <Label>{t('deathDate')}</Label>
            <div className="grid grid-cols-3 gap-2">
              <Input
                type="number"
                placeholder={t('year')}
                value={formData.deathYear || ''}
                onChange={(e) => handleInputChange('deathYear', e.target.value ? parseInt(e.target.value) : null)}
                min={0}
                max={2100}
              />
              <Input
                type="number"
                placeholder={t('month')}
                value={formData.deathMonth || ''}
                onChange={(e) => handleInputChange('deathMonth', e.target.value ? parseInt(e.target.value) : null)}
                min={1}
                max={12}
              />
              <Input
                type="number"
                placeholder={t('day')}
                value={formData.deathDay || ''}
                onChange={(e) => handleInputChange('deathDay', e.target.value ? parseInt(e.target.value) : null)}
                min={1}
                max={31}
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
                  ...
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
