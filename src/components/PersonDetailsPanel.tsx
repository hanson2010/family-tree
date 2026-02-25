'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/LocaleProvider';
import { useSession } from 'next-auth/react';
import type { Person } from '@/types';
import { Gender } from '@/types';
import { Edit, Trash2, User, GitBranch } from 'lucide-react';

interface PersonDetailsPanelProps {
  person: Person | null;
  onEdit: (person: Person) => void;
  onDelete: (person: Person) => void;
  onChangeRelationships?: (person: Person) => void;
}

export function PersonDetailsPanel({ person, onEdit, onDelete, onChangeRelationships }: PersonDetailsPanelProps) {
  const { t } = useLocale();
  const { status } = useSession();
  const isAuthenticated = status === 'authenticated';

  if (!person) {
    return (
      <div className="bg-card border rounded-lg p-4">
        <div className="text-center text-muted-foreground">
          <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>{t('selectPerson')}</p>
        </div>
      </div>
    );
  }

  const formatDate = (year?: number | null, month?: number | null, day?: number | null) => {
    if (!year && !month && !day) return null;
    const parts: string[] = [];
    if (year) parts.push(`${year}${t('year')}`);
    if (month) parts.push(`${month}${t('month')}`);
    if (day) parts.push(`${day}${t('day')}`);
    return parts.join('');
  };

  const birthDate = formatDate(person.birthYear, person.birthMonth, person.birthDay);
  const deathDate = formatDate(person.deathYear, person.deathMonth, person.deathDay);

  const getGenderLabel = (gender: Gender) => {
    switch (gender) {
      case Gender.MALE:
        return t('male');
      case Gender.FEMALE:
        return t('female');
      default:
        return t('unknown');
    }
  };

  return (
    <div className="bg-card border rounded-lg p-4 space-y-4">
      {/* Avatar and Name */}
      <div className="flex items-start gap-4">
        {person.avatar ? (
          <img
            src={person.avatar}
            alt={person.name}
            className="w-16 h-16 rounded-full object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <User className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{person.name}</h3>
          {person.courtesyName && (
            <p className="text-sm text-muted-foreground">
              {t('courtesyName')}: {person.courtesyName}
            </p>
          )}
          {person.artName && (
            <p className="text-sm text-muted-foreground">
              {t('artName')}: {person.artName}
            </p>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t('gender')}</span>
          <span>{getGenderLabel(person.gender)}</span>
        </div>

        {birthDate && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('birthDate')}</span>
            <span>{birthDate}</span>
          </div>
        )}

        {deathDate && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('deathDate')}</span>
            <span>{deathDate}</span>
          </div>
        )}

        {person.relativeGeneration !== undefined && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('generationRange')}</span>
            <span>{person.relativeGeneration}</span>
          </div>
        )}

        {person.isPrivate && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('isPrivate')}</span>
            <span className="text-amber-600">✓</span>
          </div>
        )}
      </div>

      {/* Actions - Only show for authenticated users */}
      {isAuthenticated && (
        <div className="space-y-2 pt-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onEdit(person)}
            >
              <Edit className="w-4 h-4 mr-1" />
              {t('edit')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="flex-1"
              onClick={() => onDelete(person)}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              {t('delete')}
            </Button>
          </div>
          {onChangeRelationships && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onChangeRelationships(person)}
            >
              <GitBranch className="w-4 h-4 mr-1" />
              {t('changeRelationship')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
