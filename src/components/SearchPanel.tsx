'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSession } from 'next-auth/react';
import { useLocale } from '@/components/LocaleProvider';
import { Search, UserPlus, GitBranch, Database } from 'lucide-react';

interface SearchPanelProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddPerson: () => void;
  onAddRelationship: () => void;
  onSeedData: () => void;
}

export function SearchPanel({
  searchQuery,
  onSearchChange,
  onAddPerson,
  onAddRelationship,
  onSeedData,
}: SearchPanelProps) {
  const { data: session, status } = useSession();
  const { t } = useLocale();
  const isAuthenticated = status === 'authenticated';

  return (
    <div className="bg-card border rounded-lg p-4 space-y-4">
      {/* Search */}
      <div className="space-y-2">
        <Label htmlFor="search">{t('searchByName')}</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="search"
            placeholder={t('searchByName')}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Actions */}
      {isAuthenticated && (
        <div className="space-y-2">
          {/* Add Person */}
          <Button
            className="w-full justify-start"
            onClick={onAddPerson}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            {t('addPerson')}
          </Button>

          {/* Add Relationship */}
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={onAddRelationship}
          >
            <GitBranch className="h-4 w-4 mr-2" />
            {t('addRelationship')}
          </Button>
        </div>
      )}

      {/* Divider */}
      <div className="border-t" />

      {/* Seed Data (Development) */}
      {isAuthenticated && (
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground"
          onClick={onSeedData}
        >
          <Database className="h-4 w-4 mr-2" />
          {t('seedData')}
        </Button>
      )}

      {/* Footer */}
      <div className="pt-2 border-t">
        <p className="text-xs text-muted-foreground text-center">
          {t('appName')}
        </p>
        <p className="text-xs text-muted-foreground text-center mt-1">
          v1.0.0
        </p>
      </div>
    </div>
  );
}
