'use client';

import * as React from 'react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { ChevronRight, Database, Loader2, UserPlus } from 'lucide-react';
import { Header } from '@/components/Header';
import { FamilyTreeCanvas } from '@/components/FamilyTreeCanvas';
import { LeftPanel } from '@/components/LeftPanel';
import { PersonDetailsPanel } from '@/components/PersonDetailsPanel';
import { PersonAvatar } from '@/components/PersonAvatar';
import { PersonForm } from '@/components/PersonForm';
import { AddRelationshipForm } from '@/components/AddRelationshipForm';
import { QuickRelationshipForm } from '@/components/QuickRelationshipForm';
import { ChangeRelationshipForm } from '@/components/ChangeRelationshipForm';
import { ImportDialog } from '@/components/ImportDialog';
import { GroupPhotoDialog } from '@/components/GroupPhotoDialog';
import { GoogleIcon } from '@/components/GoogleIcon';
import { BrandMark } from '@/components/BrandMark';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useLocale } from '@/components/LocaleProvider';
import { cn } from '@/lib/utils';
import type { Person, Relationship, GenerationRange, PersonFormData, RelationshipFormData, Gender } from '@/types';
import { GenerationCalculator } from '@/lib/generation-calculator';
import { connectedPersonIds, linkedPersonIds } from '@/lib/candidates';
import { connectFiltered } from '@/lib/tree-filter';

const SELECTED_PERSON_KEY = 'selectedPersonId';

function readStoredPersonId(): string | null {
  try {
    return localStorage.getItem(SELECTED_PERSON_KEY);
  } catch {
    return null;
  }
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const { t } = useLocale();
  const isAuthenticated = status === 'authenticated';

  // State
  const [persons, setPersons] = useState<Person[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Panels shown as drawers on small screens
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Form state
  const [isPersonFormOpen, setIsPersonFormOpen] = useState(false);
  const [personFormMode, setPersonFormMode] = useState<'create' | 'edit'>('create');
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);

  const [isRelationshipFormOpen, setIsRelationshipFormOpen] = useState(false);
  const [relationshipFormMode, setRelationshipFormMode] = useState<'create' | 'edit'>('create');
  const [editingRelationship, setEditingRelationship] = useState<Relationship | null>(null);

  const [isQuickRelationshipFormOpen, setIsQuickRelationshipFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isGroupPhotoOpen, setIsGroupPhotoOpen] = useState(false);
  const [isDeleteRelationshipFormOpen, setIsDeleteRelationshipFormOpen] = useState(false);

  const [personToDelete, setPersonToDelete] = useState<Person | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');

  const [generationRange, setGenerationRange] = useState<GenerationRange>({
    ancestors: 3,
    descendants: 3,
  });

  // Filter state for gender and living in year
  const [filterGenders, setFilterGenders] = useState<Gender[]>([]);
  const [filterLivingInYear, setFilterLivingInYear] = useState<number | null>(null);

  // Fetch data. The loading screen is only shown for the first load, so the tree stays in place on refresh.
  const fetchData = useCallback(async () => {
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

  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;

  useEffect(() => {
    fetchDataRef.current();
  }, []);

  const selectPerson = useCallback((personId: string) => {
    setSelectedPersonId(personId);
    setIsMenuOpen(false);
    try {
      localStorage.setItem(SELECTED_PERSON_KEY, personId);
    } catch {
      // Storage unavailable; the selection just won't be remembered
    }
  }, []);

  // Make sure someone is always at the center: the person viewed last time, otherwise a random one
  useEffect(() => {
    if (isLoading || persons.length === 0) return;
    if (selectedPersonId && persons.some((p) => p.id === selectedPersonId)) return;

    const storedId = readStoredPersonId();
    if (storedId && persons.some((p) => p.id === storedId)) {
      setSelectedPersonId(storedId);
      return;
    }

    const publicPersons = persons.filter((p) => !p.isPrivate);
    const candidates = publicPersons.length > 0 ? publicPersons : persons;
    setSelectedPersonId(candidates[Math.floor(Math.random() * candidates.length)].id);
  }, [isLoading, persons, selectedPersonId]);

  // Close drawers with Escape
  useEffect(() => {
    if (!isMenuOpen && !isDetailsOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
        setIsDetailsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen, isDetailsOpen]);

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
  const { filteredPersons, connectorIds } = React.useMemo(() => {
    // Privacy filter - only show private persons to their creator
    const allowed = visiblePersons.filter(
      (person) => !person.isPrivate || session?.user?.id === person.createdBy
    );

    const matches = (person: Person) => {
      if (filterGenders.length > 0 && !filterGenders.includes(person.gender)) return false;
      // Living in year: born no later than, and not dead before, the year
      if (filterLivingInYear !== null) {
        if (person.birthYear && person.birthYear > filterLivingInYear) return false;
        if (person.deathYear && person.deathYear < filterLivingInYear) return false;
      }
      return true;
    };

    const isFiltering = filterGenders.length > 0 || filterLivingInYear !== null;
    if (!isFiltering || !selectedPersonId) {
      return { filteredPersons: allowed, connectorIds: new Set<string>() };
    }

    // One connected tree around the selected person: the matching persons, plus the
    // non-matching persons needed to connect them, shown as connectors
    const tree = connectFiltered(
      selectedPersonId,
      new Set(allowed.map((p) => p.id)),
      new Set(allowed.filter(matches).map((p) => p.id)),
      relationships
    );
    return { filteredPersons: allowed.filter((p) => tree.ids.has(p.id)), connectorIds: tree.connectorIds };
  }, [visiblePersons, relationships, session, selectedPersonId, filterGenders, filterLivingInYear]);

  // Handlers
  const requireSignIn = useCallback(() => {
    if (status === 'authenticated') return true;
    toast({
      variant: 'destructive',
      title: t('authenticationRequired'),
      description: t('pleaseSignIn'),
    });
    return false;
  }, [status, toast, t]);

  const handleAddPerson = useCallback(() => {
    if (!requireSignIn()) return;
    setIsMenuOpen(false);
    setPersonFormMode('create');
    setEditingPerson(null);
    setIsPersonFormOpen(true);
  }, [requireSignIn]);

  // Only the creator of a person can change them
  const userId = session?.user?.id;
  const handleEditPerson = useCallback((person: Person) => {
    if (!userId || person.createdBy !== userId) return;
    setPersonFormMode('edit');
    setEditingPerson(person);
    setIsPersonFormOpen(true);
  }, [userId]);

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

    // Put a newly added person at the center, once the list contains them
    const createdId = personFormMode === 'create' ? (await response.json()).data?.id : null;
    await fetchData();
    if (createdId) selectPerson(createdId);
  }, [personFormMode, editingPerson, fetchData, selectPerson, t]);

  const handleAddRelationship = useCallback(() => {
    if (!requireSignIn()) return;
    setIsMenuOpen(false);
    setRelationshipFormMode('create');
    setEditingRelationship(null);
    setIsRelationshipFormOpen(true);
  }, [requireSignIn]);

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

  const handleQuickAddRelationship = useCallback(() => {
    if (!requireSignIn()) return;
    setIsMenuOpen(false);
    setIsQuickRelationshipFormOpen(true);
  }, [requireSignIn]);

  const handleImport = useCallback(() => {
    if (!requireSignIn()) return;
    setIsMenuOpen(false);
    setIsImportOpen(true);
  }, [requireSignIn]);

  const handleGroupPhoto = useCallback(() => {
    if (!requireSignIn()) return;
    setIsMenuOpen(false);
    setIsGroupPhotoOpen(true);
  }, [requireSignIn]);

  const handleDeleteRelationship = useCallback((_person: Person) => {
    if (!requireSignIn()) return;
    setIsDetailsOpen(false);
    setIsDeleteRelationshipFormOpen(true);
  }, [requireSignIn]);

  const handleDeleteRelationshipConfirm = useCallback(async (relationshipId: string) => {
    const response = await fetch(`/api/relationships/${relationshipId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || t('failedToDeleteRelationship'));
    }

    fetchData();
  }, [fetchData, t]);

  const handleUpdateRelationship = useCallback(async (relationshipId: string, data: RelationshipFormData) => {
    const response = await fetch(`/api/relationships/${relationshipId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || t('failedToUpdateRelationship'));
    }

    fetchData();
  }, [fetchData, t]);

  const handleSeedData = useCallback(async () => {
    if (!requireSignIn()) return;

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
        description: t('failedToSave'),
      });
    }
  }, [requireSignIn, toast, fetchData, t]);

  const handleRefresh = useCallback(() => {
    // Pick among the persons that satisfy the active filters
    const eligiblePersons = persons.filter(person => {
      if (person.id === selectedPersonId && persons.length > 1) {
        return false;
      }
      if (filterGenders.length > 0 && !filterGenders.includes(person.gender)) {
        return false;
      }
      if (filterLivingInYear !== null) {
        if (person.birthYear && person.birthYear > filterLivingInYear) {
          return false;
        }
        if (person.deathYear && person.deathYear < filterLivingInYear) {
          return false;
        }
      }
      return true;
    });

    if (eligiblePersons.length > 0) {
      const randomIndex = Math.floor(Math.random() * eligiblePersons.length);
      setSearchQuery('');
      selectPerson(eligiblePersons[randomIndex].id);
    }
  }, [persons, selectedPersonId, filterGenders, filterLivingInYear, selectPerson]);

  // Deleting asks for confirmation first
  const handleDeletePerson = useCallback((person: Person) => {
    if (!requireSignIn()) return;
    setPersonToDelete(person);
  }, [requireSignIn]);

  const handleDeletePersonConfirm = useCallback(async () => {
    if (!personToDelete) return;
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/persons/${personToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete person');
      }

      toast({
        title: t('personDeleted'),
        description: personToDelete.name,
      });

      if (selectedPersonId === personToDelete.id) {
        setSelectedPersonId(null);
        setIsDetailsOpen(false);
      }
      setPersonToDelete(null);

      fetchData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('failedToDelete'),
      });
    } finally {
      setIsDeleting(false);
    }
  }, [personToDelete, toast, fetchData, t, selectedPersonId]);

  // Get the currently selected/centered person
  const selectedPerson = React.useMemo(() => {
    if (!selectedPersonId) return null;
    return persons.find(p => p.id === selectedPersonId) || null;
  }, [persons, selectedPersonId]);

  // Relationships between persons the user can see
  const visibleRelationships = React.useMemo(() => {
    const ids = new Set(persons.map((p) => p.id));
    return relationships.filter((r) => ids.has(r.personAId) && ids.has(r.personBId));
  }, [persons, relationships]);

  const linkedIds = React.useMemo(() => linkedPersonIds(visibleRelationships), [visibleRelationships]);

  // Persons the user created in the current family tree: everyone connected to the selected person
  const ownPersonsInTree = React.useMemo(() => {
    if (!selectedPersonId || !userId) return [];
    const tree = connectedPersonIds(selectedPersonId, visibleRelationships);
    return persons.filter((p) => tree.has(p.id) && p.createdBy === userId);
  }, [persons, visibleRelationships, selectedPersonId, userId]);

  const canEditSelected = !!selectedPerson && !!userId && selectedPerson.createdBy === userId;

  const drawerBase =
    'absolute inset-y-0 z-40 w-80 max-w-[85vw] overflow-y-auto bg-background shadow-xl transition-[transform,visibility] duration-200 lg:visible lg:static lg:z-auto lg:w-72 lg:shrink-0 lg:translate-x-0 lg:shadow-none';

  return (
    <div className="flex h-dvh flex-col bg-background">
      <Header onOpenMenu={() => setIsMenuOpen(true)} />

      <div className="relative flex min-h-0 flex-1">
        {/* Backdrop behind an open drawer */}
        {(isMenuOpen || isDetailsOpen) && (
          <div
            className="absolute inset-0 z-30 bg-black/30 lg:hidden"
            onClick={() => {
              setIsMenuOpen(false);
              setIsDetailsOpen(false);
            }}
          />
        )}

        {/* Left panel - search, filters, actions */}
        <aside className={cn(drawerBase, 'left-0 border-r', isMenuOpen ? 'translate-x-0' : 'invisible -translate-x-full')}>
          <LeftPanel
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onAddPerson={handleAddPerson}
            onAddRelationship={handleAddRelationship}
            onQuickAddRelationship={handleQuickAddRelationship}
            onImport={handleImport}
            onGroupPhoto={handleGroupPhoto}
            onRefresh={handleRefresh}
            persons={persons}
            onSelectPerson={selectPerson}
            filterGenders={filterGenders}
            filterLivingInYear={filterLivingInYear}
            generationRange={generationRange}
            onFilterGendersChange={setFilterGenders}
            onFilterLivingInYearChange={setFilterLivingInYear}
            onGenerationRangeChange={setGenerationRange}
            onFilterReset={() => {
              setFilterGenders([]);
              setFilterLivingInYear(null);
            }}
          />
        </aside>

        {/* Canvas */}
        <main className="relative min-w-0 flex-1">
          {isLoading || (persons.length > 0 && !selectedPerson) ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
          ) : persons.length === 0 ? (
            <div className="tree-canvas flex h-full items-center justify-center p-6">
              <div className="max-w-sm rounded-xl border bg-card p-8 text-center shadow-sm">
                <BrandMark className="mx-auto h-12 w-12 rounded-lg" />
                <h2 className="font-display mt-4 text-xl font-semibold">{t('emptyTitle')}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {isAuthenticated ? t('emptyDescription') : t('signInToAdd')}
                </p>
                <div className="mt-6 flex flex-col gap-2">
                  {isAuthenticated ? (
                    <>
                      <Button onClick={handleAddPerson}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        {t('addPerson')}
                      </Button>
                      <Button variant="outline" onClick={handleSeedData}>
                        <Database className="mr-2 h-4 w-4" />
                        {t('seedData')}
                      </Button>
                    </>
                  ) : (
                    status !== 'loading' && (
                      <Button variant="outline" onClick={() => signIn('google')}>
                        <GoogleIcon className="mr-2 h-4 w-4" />
                        {t('signInWithGoogle')}
                      </Button>
                    )
                  )}
                </div>
              </div>
            </div>
          ) : (
            <FamilyTreeCanvas
              persons={filteredPersons}
              connectorIds={connectorIds}
              allPersons={persons}
              relationships={relationships}
              selectedPersonId={selectedPersonId}
              onSelectPerson={selectPerson}
              onEditPerson={handleEditPerson}
            />
          )}

          {/* Selected person bar, in place of the details panel on small screens */}
          {selectedPerson && (
            <button
              type="button"
              onClick={() => setIsDetailsOpen(true)}
              className="absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-xl border bg-card p-2.5 text-left shadow-lg lg:hidden"
            >
              <PersonAvatar person={selectedPerson} className="h-10 w-10" />
              <span className="min-w-0 flex-1">
                <span className="font-display block truncate font-semibold">{selectedPerson.name}</span>
                {(selectedPerson.birthYear || selectedPerson.deathYear) && (
                  <span className="block text-xs tabular-nums text-muted-foreground">
                    {selectedPerson.birthYear ?? '?'} – {selectedPerson.deathYear ?? ''}
                  </span>
                )}
              </span>
              <span className="flex items-center text-sm text-muted-foreground">
                {t('details')}
                <ChevronRight className="h-4 w-4" />
              </span>
            </button>
          )}
        </main>

        {/* Right panel - person details */}
        <aside className={cn(drawerBase, 'right-0 border-l', isDetailsOpen ? 'translate-x-0' : 'invisible translate-x-full')}>
          <PersonDetailsPanel
            person={selectedPerson}
            persons={persons}
            relationships={relationships}
            canEdit={canEditSelected}
            onSelectPerson={selectPerson}
            onEdit={handleEditPerson}
            onDelete={handleDeletePerson}
            onChangeRelationships={handleDeleteRelationship}
          />
        </aside>
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
      <AddRelationshipForm
        isOpen={isRelationshipFormOpen}
        mode={relationshipFormMode}
        relationship={editingRelationship}
        persons={persons}
        linkedIds={linkedIds}
        onSubmit={handleRelationshipFormSubmit}
        onClose={() => setIsRelationshipFormOpen(false)}
      />

      {/* Quick relationship form dialog */}
      <QuickRelationshipForm
        isOpen={isQuickRelationshipFormOpen}
        persons={persons}
        linkedIds={linkedIds}
        onSubmit={handleRelationshipFormSubmit}
        onClose={() => setIsQuickRelationshipFormOpen(false)}
      />

      <ImportDialog
        isOpen={isImportOpen}
        persons={persons}
        onClose={() => setIsImportOpen(false)}
        onImported={fetchData}
      />

      <GroupPhotoDialog
        isOpen={isGroupPhotoOpen}
        persons={ownPersonsInTree}
        onClose={() => setIsGroupPhotoOpen(false)}
        onSaved={fetchData}
      />

      {/* Modify or remove relationship form dialog */}
      <ChangeRelationshipForm
        isOpen={isDeleteRelationshipFormOpen}
        relationships={relationships}
        persons={persons}
        preselectedPersonId={selectedPersonId || undefined}
        onDelete={handleDeleteRelationshipConfirm}
        onUpdate={handleUpdateRelationship}
        onClose={() => setIsDeleteRelationshipFormOpen(false)}
      />

      {/* Delete person confirmation */}
      <Dialog open={!!personToDelete} onOpenChange={(open) => !open && !isDeleting && setPersonToDelete(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t('deletePersonTitle')}</DialogTitle>
            <DialogDescription>
              {t('deletePersonConfirm').replace('{name}', personToDelete?.name ?? '')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPersonToDelete(null)} disabled={isDeleting}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeletePersonConfirm} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
