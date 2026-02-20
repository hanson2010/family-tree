'use client';

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Header } from '@/components/Header';
import { FamilyTreeCanvas } from '@/components/FamilyTreeCanvas';
import { SearchPanel } from '@/components/SearchPanel';
import { PersonDetailsPanel } from '@/components/PersonDetailsPanel';
import { PersonForm } from '@/components/PersonForm';
import { RelationshipForm } from '@/components/RelationshipForm';
import { useToast } from '@/components/ui/use-toast';
import { useLocale } from '@/components/LocaleProvider';
import type { Person, Relationship, GenerationRange, PersonFormData, RelationshipFormData } from '@/types';
import { GenerationCalculator } from '@/lib/generation-calculator';

export default function HomePage() {
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const { t } = useLocale();

  // State
  const [persons, setPersons] = useState<Person[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initialPersonSet, setInitialPersonSet] = useState(false);

  // Form state
  const [isPersonFormOpen, setIsPersonFormOpen] = useState(false);
  const [personFormMode, setPersonFormMode] = useState<'create' | 'edit'>('create');
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);

  const [isRelationshipFormOpen, setIsRelationshipFormOpen] = useState(false);
  const [relationshipFormMode, setRelationshipFormMode] = useState<'create' | 'edit'>('create');
  const [editingRelationship, setEditingRelationship] = useState<Relationship | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');

  const [generationRange, setGenerationRange] = useState<GenerationRange>({
    ancestors: 2,
    descendants: 3,
  });

  // Fetch data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [personsRes, relationshipsRes] = await Promise.all([
        fetch('/api/persons'),
        fetch('/api/relationships'),
      ]);

      if (personsRes.ok) {
        const personsData = await personsRes.json();
        setPersons(personsData.data || []);
      }

      if (relationshipsRes.ok) {
        const relationshipsData = await relationshipsRes.json();
        setRelationships(relationshipsData.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('failedToLoad'),
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Select a random public person as center for anonymous users
  useEffect(() => {
    if (!isLoading && !initialPersonSet && persons.length > 0) {
      // Get public persons only
      const publicPersons = persons.filter(p => !p.isPrivate);
      if (publicPersons.length > 0) {
        // Select a random public person
        const randomIndex = Math.floor(Math.random() * publicPersons.length);
        setSelectedPersonId(publicPersons[randomIndex].id);
      }
      setInitialPersonSet(true);
    }
  }, [isLoading, persons, initialPersonSet]);

  // Calculate relative generations
  const visiblePersons = React.useMemo(() => {
    if (!selectedPersonId) {
      return persons.map(p => ({ ...p, relativeGeneration: 0 }));
    }

    const calculator = new GenerationCalculator(persons, relationships);
    const generations = calculator.calculateRelativeGenerations(selectedPersonId);

    return persons.map(p => ({
      ...p,
      relativeGeneration: generations.get(p.id) ?? 0,
    })).filter(p => {
      const gen = generations.get(p.id) ?? 0;
      return gen >= -generationRange.ancestors && gen <= generationRange.descendants;
    });
  }, [persons, relationships, selectedPersonId, generationRange]);

  // Apply filters
  const filteredPersons = React.useMemo(() => {
    return visiblePersons.filter(person => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!person.name.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Privacy filter - anonymous users can only see public persons
      if (person.isPrivate) {
        // Only show private persons to their creator
        if (session?.user?.id !== person.createdBy) {
          return false;
        }
      }

      return true;
    });
  }, [visiblePersons, searchQuery, session]);

  // Handlers
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleAddPerson = useCallback(() => {
    if (status !== 'authenticated') {
      toast({
        variant: 'destructive',
        title: t('authenticationRequired'),
        description: t('pleaseSignIn'),
      });
      return;
    }
    setPersonFormMode('create');
    setEditingPerson(null);
    setIsPersonFormOpen(true);
  }, [status, toast, t]);

  const handleEditPerson = useCallback((person: Person) => {
    setPersonFormMode('edit');
    setEditingPerson(person);
    setIsPersonFormOpen(true);
  }, []);

  const handlePersonFormSubmit = useCallback(async (data: PersonFormData) => {
    const url = personFormMode === 'create' ? '/api/persons' : `/api/persons/${editingPerson?.id}`;
    const method = personFormMode === 'create' ? 'POST' : 'PUT';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || t('failedToSave'));
    }

    fetchData();
  }, [personFormMode, editingPerson, fetchData, t]);

  const handleAddRelationship = useCallback(() => {
    if (status !== 'authenticated') {
      toast({
        variant: 'destructive',
        title: t('authenticationRequired'),
        description: t('pleaseSignIn'),
      });
      return;
    }
    setRelationshipFormMode('create');
    setEditingRelationship(null);
    setIsRelationshipFormOpen(true);
  }, [status, toast, t]);

  const handleRelationshipFormSubmit = useCallback(async (data: RelationshipFormData) => {
    const url = relationshipFormMode === 'create' ? '/api/relationships' : `/api/relationships/${editingRelationship?.id}`;
    const method = relationshipFormMode === 'create' ? 'POST' : 'PUT';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || t('failedToSave'));
    }

    fetchData();
  }, [relationshipFormMode, editingRelationship, fetchData, t]);

  const handleSeedData = useCallback(async () => {
    if (status !== 'authenticated') {
      toast({
        variant: 'destructive',
        title: t('authenticationRequired'),
        description: t('pleaseSignIn'),
      });
      return;
    }

    try {
      const response = await fetch('/api/seed', { method: 'POST' });

      if (!response.ok) {
        throw new Error('Failed to seed data');
      }

      toast({
        title: t('dataSeeded'),
        description: t('sampleDataAdded'),
      });

      fetchData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('failedToLoad'),
      });
    }
  }, [status, toast, fetchData, t]);

  const handleDeletePerson = useCallback(async (person: Person) => {
    if (status !== 'authenticated') {
      toast({
        variant: 'destructive',
        title: t('authenticationRequired'),
        description: t('pleaseSignIn'),
      });
      return;
    }

    try {
      const response = await fetch(`/api/persons/${person.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete person');
      }

      toast({
        title: t('personUpdated'),
        description: `${person.name} has been deleted`,
      });

      if (selectedPersonId === person.id) {
        setSelectedPersonId(null);
      }

      fetchData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('failedToSave'),
      });
    }
  }, [status, toast, fetchData, t, selectedPersonId]);

  // Get the currently selected/centered person
  const selectedPerson = React.useMemo(() => {
    if (!selectedPersonId) return null;
    return persons.find(p => p.id === selectedPersonId) || null;
  }, [persons, selectedPersonId]);

  return (
    <div className="flex h-screen bg-background">
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <div className="flex-1 flex overflow-hidden">
          {/* Left panel - Search */}
          <div className="hidden lg:block w-72 border-r p-4 overflow-y-auto">
            <SearchPanel
              searchQuery={searchQuery}
              onSearchChange={handleSearchChange}
              onAddPerson={handleAddPerson}
              onAddRelationship={handleAddRelationship}
              onSeedData={handleSeedData}
            />
          </div>

          {/* Canvas */}
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : persons.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">{t('noPersons')}</p>
                {status !== 'authenticated' && (
                  <p className="text-sm text-muted-foreground">{t('signInToAdd')}</p>
                )}
              </div>
            </div>
          ) : (
            <FamilyTreeCanvas
              persons={filteredPersons}
              relationships={relationships}
              selectedPersonId={selectedPersonId}
              onSelectPerson={setSelectedPersonId}
              onEditPerson={handleEditPerson}
            />
          )}

          {/* Right panel - Person details */}
          <div className="hidden lg:block w-72 border-l p-4 overflow-y-auto">
            <PersonDetailsPanel
              person={selectedPerson}
              onEdit={handleEditPerson}
              onDelete={handleDeletePerson}
            />
          </div>
        </div>
      </div>

      {/* Person form dialog */}
      <PersonForm
        isOpen={isPersonFormOpen}
        mode={personFormMode}
        person={editingPerson}
        onSubmit={handlePersonFormSubmit}
        onClose={() => setIsPersonFormOpen(false)}
      />

      {/* Relationship form dialog */}
      <RelationshipForm
        isOpen={isRelationshipFormOpen}
        mode={relationshipFormMode}
        relationship={editingRelationship}
        persons={persons}
        onSubmit={handleRelationshipFormSubmit}
        onClose={() => setIsRelationshipFormOpen(false)}
      />
    </div>
  );
}
