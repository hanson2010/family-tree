'use client';

import * as React from 'react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { ChevronRight, Database, Loader2, LogIn, UserPlus } from 'lucide-react';
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
import { MergePersonDialog } from '@/components/MergePersonDialog';
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
import { searchForest, searchMatches } from '@/lib/search-forest';
import { personTitle } from '@/lib/person-title';

const SELECTED_PERSON_KEY = 'selectedPersonId';

/** The address of a person: the tree centered on them */
export const personPath = (id: string) => `/person/${encodeURIComponent(id)}`;

/** The person in an address like /person/{id}, or null */
function personIdFromPath(pathname: string): string | null {
  const match = /^\/person\/([^/]+)\/?$/.exec(pathname);
  return match ? decodeURIComponent(match[1]) : null;
}

/** The address of the tree centered on a person, with the search shown on the canvas (`?q=`) */
function treeAddress(personId: string | null, search: string): string {
  const path = personId ? personPath(personId) : '/';
  return search ? `${path}?q=${encodeURIComponent(search)}` : path;
}

/** The search in the current address ('' for none) */
function searchFromAddress(): string {
  return new URLSearchParams(window.location.search).get('q')?.trim() ?? '';
}

function readStoredPersonId(): string | null {
  try {
    return localStorage.getItem(SELECTED_PERSON_KEY);
  } catch {
    return null;
  }
}

/**
 * The family tree app, at / and at /person/{id}. The address follows the person at the center,
 * so a refresh, a bookmark or a shared link returns to them, and Back returns to the person
 * before. `personId` is the person in the address the page was opened with.
 */
export function FamilyTreeApp({ personId: initialPersonId }: { personId?: string } = {}) {
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const { t } = useLocale();
  const isAuthenticated = status === 'authenticated';

  // State
  const [persons, setPersons] = useState<Person[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const selectedPersonIdRef = useRef(selectedPersonId);
  selectedPersonIdRef.current = selectedPersonId;
  // Counts choices of the person already selected, which change nothing else, so the tree
  // still centers on them (e.g. after panning away, or searching for the person just added)
  const [recenterRequest, setRecenterRequest] = useState(0);
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
  // Person A filled in when the add form is opened for a person
  const [relationshipPersonA, setRelationshipPersonA] = useState<string | undefined>(undefined);

  const [isQuickRelationshipFormOpen, setIsQuickRelationshipFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isGroupPhotoOpen, setIsGroupPhotoOpen] = useState(false);
  const [mergingPerson, setMergingPerson] = useState<Person | null>(null);
  const [isDeleteRelationshipFormOpen, setIsDeleteRelationshipFormOpen] = useState(false);

  const [personToDelete, setPersonToDelete] = useState<Person | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  // The search shown on the canvas as a forest of matches ('' for the family tree)
  const [activeSearch, setActiveSearch] = useState('');
  const activeSearchRef = useRef(activeSearch);
  activeSearchRef.current = activeSearch;
  // Whether the selected person was clicked within that search (before, it is whoever was selected)
  const [chosenInSearch, setChosenInSearch] = useState(false);

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

  /**
   * Put a person at the center, remember them for the next visit, and show their address. A choice
   * by the user adds a history entry (Back returns to the person before); one made by the app
   * (opening the page, Back itself) replaces the current entry. `search` is the search shown on the
   * canvas, also kept in the address ('' for the family tree); it stays as it is unless given.
   * `chosen` says the user picked the person within that search, kept in the history entry so Back
   * and a refresh restore it; with 'none' it is read from the current entry.
   */
  const centerPerson = useCallback(
    (
      personId: string | null,
      history: 'push' | 'replace' | 'none',
      search = activeSearchRef.current,
      chosen = false
    ) => {
      const isChosen =
        history === 'none' ? (window.history.state as { chosenInSearch?: boolean } | null)?.chosenInSearch === true : chosen;
      setChosenInSearch(search !== '' && isChosen);
      if (personId) {
        setSelectedPersonId(personId);
        try {
          localStorage.setItem(SELECTED_PERSON_KEY, personId);
        } catch {
          // Storage unavailable; the selection just won't be remembered
        }
      }
      setActiveSearch(search);
      activeSearchRef.current = search;
      const address = treeAddress(personId ?? selectedPersonIdRef.current, search);
      if (history !== 'none') {
        const state = { chosenInSearch: search !== '' && isChosen };
        // The same address again only updates the entry, so Back still goes somewhere different
        if (history === 'push' && window.location.pathname + window.location.search !== address) {
          window.history.pushState(state, '', address);
        } else {
          window.history.replaceState(state, '', address);
        }
      }
    },
    []
  );

  /** The user chose a person; `search` replaces the search shown on the canvas when given */
  const selectPerson = useCallback((personId: string, search?: string) => {
    if (personId === selectedPersonIdRef.current) setRecenterRequest((n) => n + 1);
    const nextSearch = search ?? activeSearchRef.current;
    centerPerson(personId, 'push', nextSearch, nextSearch !== '');
    setIsMenuOpen(false);
  }, [centerPerson]);

  // Make sure someone is always at the center: the person in the address, otherwise the person
  // viewed last time, otherwise a random one
  const triedAddress = useRef(false);
  useEffect(() => {
    if (isLoading || persons.length === 0) return;
    if (selectedPersonId && persons.some((p) => p.id === selectedPersonId)) return;

    if (initialPersonId && !triedAddress.current) {
      triedAddress.current = true;
      if (persons.some((p) => p.id === initialPersonId)) {
        centerPerson(initialPersonId, 'none');
        return;
      }
      // Missing, or another user's private person: the same answer, so nothing is revealed
      toast({
        variant: 'destructive',
        title: t('personNotFound'),
        description: isAuthenticated ? t('personNotFoundHint') : t('personNotFoundSignIn'),
      });
    }

    const storedId = readStoredPersonId();
    if (storedId && persons.some((p) => p.id === storedId)) {
      centerPerson(storedId, 'replace');
      return;
    }

    const publicPersons = persons.filter((p) => !p.isPrivate);
    const candidates = publicPersons.length > 0 ? publicPersons : persons;
    centerPerson(candidates[Math.floor(Math.random() * candidates.length)].id, 'replace');
  }, [isLoading, persons, selectedPersonId, initialPersonId, centerPerson, isAuthenticated, t, toast]);

  // A search in the address the page was opened with is shown on the canvas
  useEffect(() => {
    const search = searchFromAddress();
    if (!search) return;
    setSearchQuery(search);
    setActiveSearch(search);
    activeSearchRef.current = search;
  }, []);

  // Back and Forward: show the person and the search in the address
  useEffect(() => {
    const onPopState = () => {
      const id = personIdFromPath(window.location.pathname);
      const search = searchFromAddress();
      setSearchQuery(search);
      centerPerson(id && persons.some((p) => p.id === id) ? id : null, 'none', search);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [persons, centerPerson]);

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

  // Gender and "living in year" filters
  const matchesFilters = useCallback(
    (person: Person) => {
      if (filterGenders.length > 0 && !filterGenders.includes(person.gender)) return false;
      // Living in year: born no later than, and not dead before, the year
      if (filterLivingInYear !== null) {
        if (person.birthYear && person.birthYear > filterLivingInYear) return false;
        if (person.deathYear && person.deathYear < filterLivingInYear) return false;
      }
      return true;
    },
    [filterGenders, filterLivingInYear]
  );

  // Search results: matches (narrowed by the filters) as a forest; null without a search or matches
  const forest = React.useMemo(() => {
    if (!activeSearch) return null;
    const matches = searchMatches(persons, relationships, persons.filter(matchesFilters), activeSearch);
    return searchForest(persons, relationships, matches);
  }, [activeSearch, persons, relationships, matchesFilters]);
  const forestPersons = React.useMemo(
    () => (forest ? persons.filter((p) => forest.positions.has(p.id)) : []),
    [forest, persons]
  );

  // Apply filters
  const { filteredPersons, connectorIds } = React.useMemo(() => {
    // Privacy filter - only show private persons to their creator
    const allowed = visiblePersons.filter(
      (person) => !person.isPrivate || session?.user?.id === person.createdBy
    );
    const matches = matchesFilters;

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
  }, [visiblePersons, relationships, session, selectedPersonId, filterGenders, filterLivingInYear, matchesFilters]);

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

    // Show the saved person at once (a new one at the center), then reload in the background for
    // anything else the save changed
    const saved: Person | undefined = (await response.json()).data;
    if (saved) {
      setPersons((list) => [...list.filter((p) => p.id !== saved.id), saved]);
      if (personFormMode === 'create') selectPerson(saved.id);
    }
    fetchData();
  }, [personFormMode, editingPerson, fetchData, selectPerson, t]);

  const handleAddRelationship = useCallback(() => {
    if (!requireSignIn()) return;
    setIsMenuOpen(false);
    setRelationshipFormMode('create');
    setEditingRelationship(null);
    setRelationshipPersonA(undefined);
    setIsRelationshipFormOpen(true);
  }, [requireSignIn]);

  // From the right panel's relationship dialog: a new relationship with that person as person A
  const handleAddRelationshipFor = useCallback((personId: string) => {
    setIsDeleteRelationshipFormOpen(false);
    setRelationshipFormMode('create');
    setEditingRelationship(null);
    setRelationshipPersonA(personId);
    setIsRelationshipFormOpen(true);
  }, []);

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

    // Draw the saved relationship at once; the reload brings sibling relationships it made
    // redundant and were removed
    const saved: Relationship | undefined = (await response.json()).data;
    if (saved) setRelationships((list) => [...list.filter((r) => r.id !== saved.id), saved]);
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

  // Load persons and relationships again (e.g. after changes through MCP). The selected person
  // stays selected; if they no longer exist, the stored or a random person is chosen as on load.
  const [isReloading, setIsReloading] = useState(false);
  const handleReload = useCallback(async () => {
    setIsReloading(true);
    try {
      await fetchData();
      toast({ title: t('dataReloaded') });
    } finally {
      setIsReloading(false);
    }
  }, [fetchData, toast, t]);

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
      selectPerson(eligiblePersons[randomIndex].id, '');
    }
  }, [persons, selectedPersonId, filterGenders, filterLivingInYear, selectPerson]);

  // Run a search ('' ends it). A single match is chosen straight away, showing their family tree;
  // otherwise the matches are shown as a forest. Either way Back returns to what was shown before.
  const handleSearch = useCallback((query: string) => {
    setIsMenuOpen(false);
    const matches = query ? searchMatches(persons, relationships, persons.filter(matchesFilters), query) : [];
    if (matches.length === 1) selectPerson(matches[0].id, '');
    else centerPerson(null, 'push', query);
  }, [persons, relationships, matchesFilters, selectPerson, centerPerson]);

  // Leave the search and show the family tree of the person chosen in it
  const showFamily = useCallback((person: Person) => {
    setIsDetailsOpen(false);
    selectPerson(person.id, '');
  }, [selectPerson]);

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

  // The tab title follows the person at the center, as the page's own title does on first load
  const pageTitle = personTitle(selectedPerson);
  useEffect(() => {
    document.title = pageTitle;
  }, [pageTitle]);

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
            onSearch={handleSearch}
            search={
              activeSearch && forest
                ? { query: activeSearch, total: forest.total, shown: forest.matchIds.size }
                : null
            }
            onAddPerson={handleAddPerson}
            onAddRelationship={handleAddRelationship}
            onQuickAddRelationship={handleQuickAddRelationship}
            onImport={handleImport}
            onGroupPhoto={handleGroupPhoto}
            onRefresh={handleRefresh}
            onReload={handleReload}
            isReloading={isReloading}
            persons={persons}
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
                      <Button variant="outline" onClick={() => signIn()}>
                        <LogIn className="mr-2 h-4 w-4" />
                        {t('signIn')}
                      </Button>
                    )
                  )}
                </div>
              </div>
            </div>
          ) : (
            <FamilyTreeCanvas
              persons={forest && forest.total > 0 ? forestPersons : filteredPersons}
              connectorIds={forest && forest.total > 0 ? forest.connectorIds : connectorIds}
              forestPositions={forest && forest.total > 0 ? forest.positions : null}
              forestFocus={forest && forest.total > 0 ? forest.focus : null}
              allPersons={persons}
              relationships={relationships}
              selectedPersonId={selectedPersonId}
              recenterRequest={recenterRequest}
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
            onMerge={(person) => setMergingPerson(person)}
            onChangeRelationships={handleDeleteRelationship}
            onShowFamily={forest && forest.total > 0 && chosenInSearch ? showFamily : undefined}
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
        preselectedPersonA={relationshipPersonA}
        onSubmit={handleRelationshipFormSubmit}
        onClose={() => setIsRelationshipFormOpen(false)}
      />

      {/* Quick relationship form dialog */}
      <QuickRelationshipForm
        isOpen={isQuickRelationshipFormOpen}
        persons={persons}
        linkedIds={linkedIds}
        onSaved={fetchData}
        onClose={() => setIsQuickRelationshipFormOpen(false)}
      />

      <ImportDialog
        linkedIds={linkedIds}
        isOpen={isImportOpen}
        persons={persons}
        onClose={() => setIsImportOpen(false)}
        onImported={fetchData}
      />

      <MergePersonDialog
        isOpen={!!mergingPerson}
        person={mergingPerson}
        candidates={persons.filter((p) => !!userId && p.createdBy === userId)}
        linkedIds={linkedIds}
        relationships={relationships}
        onClose={() => setMergingPerson(null)}
        onMerged={async (keptId) => {
          await fetchData();
          selectPerson(keptId);
        }}
      />

      <GroupPhotoDialog
        linkedIds={linkedIds}
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
        onAdd={handleAddRelationshipFor}
        onClose={() => setIsDeleteRelationshipFormOpen(false)}
      />

      {/* Delete person confirmation */}
      <Dialog open={!!personToDelete} onOpenChange={(open) => !open && !isDeleting && setPersonToDelete(null)}>
        <DialogContent size="confirm">
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
