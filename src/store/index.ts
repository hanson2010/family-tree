import { create } from 'zustand';
import type { Person, Relationship, FilterState, GenerationRange, Gender, RelationshipType } from '@/types';

interface FamilyTreeState {
  // Data
  persons: Person[];
  relationships: Relationship[];

  // Selection
  selectedPersonId: string | null;
  centerPersonId: string | null;

  // Filters
  filters: FilterState;
  generationRange: GenerationRange;

  // UI State
  isLoading: boolean;
  isPersonFormOpen: boolean;
  isRelationshipFormOpen: boolean;
  editingPerson: Person | null;
  editingRelationship: Relationship | null;

  // Actions
  setPersons: (persons: Person[]) => void;
  setRelationships: (relationships: Relationship[]) => void;
  addPerson: (person: Person) => void;
  updatePerson: (person: Person) => void;
  removePerson: (id: string) => void;
  addRelationship: (relationship: Relationship) => void;
  updateRelationship: (relationship: Relationship) => void;
  removeRelationship: (id: string) => void;

  selectPerson: (id: string | null) => void;
  setCenterPerson: (id: string | null) => void;

  setFilters: (filters: Partial<FilterState>) => void;
  setGenerationRange: (range: Partial<GenerationRange>) => void;

  setIsLoading: (loading: boolean) => void;
  openPersonForm: (person?: Person) => void;
  closePersonForm: () => void;
  openRelationshipForm: (relationship?: Relationship) => void;
  closeRelationshipForm: () => void;
}

export const useFamilyTreeStore = create<FamilyTreeState>((set) => ({
  // Initial state
  persons: [],
  relationships: [],
  selectedPersonId: null,
  centerPersonId: null,
  filters: {
    genders: [],
    relationshipTypes: [],
    branchId: null,
    searchQuery: '',
    showPrivate: false,
  },
  generationRange: {
    ancestors: 2,
    descendants: 3,
  },
  isLoading: false,
  isPersonFormOpen: false,
  isRelationshipFormOpen: false,
  editingPerson: null,
  editingRelationship: null,

  // Actions
  setPersons: (persons) => set({ persons }),
  setRelationships: (relationships) => set({ relationships }),

  addPerson: (person) => set((state) => ({
    persons: [...state.persons, person],
  })),

  updatePerson: (person) => set((state) => ({
    persons: state.persons.map((p) =>
      p.id === person.id ? person : p
    ),
  })),

  removePerson: (id) => set((state) => ({
    persons: state.persons.filter((p) => p.id !== id),
    selectedPersonId: state.selectedPersonId === id ? null : state.selectedPersonId,
    centerPersonId: state.centerPersonId === id ? null : state.centerPersonId,
  })),

  addRelationship: (relationship) => set((state) => ({
    relationships: [...state.relationships, relationship],
  })),

  updateRelationship: (relationship) => set((state) => ({
    relationships: state.relationships.map((r) =>
      r.id === relationship.id ? relationship : r
    ),
  })),

  removeRelationship: (id) => set((state) => ({
    relationships: state.relationships.filter((r) => r.id !== id),
  })),

  selectPerson: (id) => set({ selectedPersonId: id }),
  setCenterPerson: (id) => set({ centerPersonId: id }),

  setFilters: (filters) => set((state) => ({
    filters: { ...state.filters, ...filters },
  })),

  setGenerationRange: (range) => set((state) => ({
    generationRange: { ...state.generationRange, ...range },
  })),

  setIsLoading: (isLoading) => set({ isLoading }),

  openPersonForm: (person) => set({
    isPersonFormOpen: true,
    editingPerson: person || null,
  }),

  closePersonForm: () => set({
    isPersonFormOpen: false,
    editingPerson: null,
  }),

  openRelationshipForm: (relationship) => set({
    isRelationshipFormOpen: true,
    editingRelationship: relationship || null,
  }),

  closeRelationshipForm: () => set({
    isRelationshipFormOpen: false,
    editingRelationship: null,
  }),
}));
