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
import type { Person, PersonFormData, Gender, AvatarUploadResponse } from '@/types';
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

      const result: AvatarUploadResponse = await response.json();

      if (result.success) {
        setFormData(prev => ({ ...prev, avatar: result.avatar }));
        toast({
          title: t('avatar'),
          description: 'Avatar uploaded successfully',
        });
      } else {
        throw new Error('Failed to upload avatar');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: error instanceof Error ? error.message : 'Failed to upload avatar',
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
        description: t('name') + ' is required',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit(formData);
      toast({
        title: mode === 'create' ? t('personCreated') : t('personUpdated'),
        description: `${formData.name} has been ${mode === 'create' ? 'added to' : 'updated in'} the family tree.`,
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
