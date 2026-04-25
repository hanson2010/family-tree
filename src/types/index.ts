// Core Enums
export enum Gender {
  MALE = '男',
  FEMALE = '女',
  UNKNOWN = '未知'
}

export enum RelationshipType {
  PARENT_CHILD = '父母子女',
  SIBLING = '兄弟姐妹',
  HALF_SIBLING = '同父异母/同母异父',
  SPOUSE = '配偶',
  CONCUBINE = '妾',
  BETROTHED = '订婚',
  ADOPTIVE_PARENT = '养父母',
  FOSTER_PARENT = '寄养父母',
  SWORN_SIBLING = '结拜兄弟姐妹'
}

// Date components for precise date handling
export interface DateComponents {
  year?: number;
  month?: number;   // 1-12
  day?: number;     // 1-31
  isLunarCalendar?: boolean;
}

// Core Interfaces
export interface Person {
  id: string;
  name: string;
  courtesyName?: string;  // zi (character) - Chinese: zi
  artName?: string;       // hao (art name) - Chinese: hao
  gender: Gender;

  // Precise birth date
  birthYear?: number | null;
  birthMonth?: number | null;
  birthDay?: number | null;

  // Precise death date
  deathYear?: number | null;
  deathMonth?: number | null;
  deathDay?: number | null;

  // Avatar - base64 encoded image
  avatar?: string | null;

  // Privacy control
  isPrivate: boolean;
  createdBy: string;

  createdAt: Date;
  updatedAt: Date;

  // Computed field (relative to selected person)
  relativeGeneration?: number;
}

export interface Relationship {
  id: string;
  personAId: string;
  personBId: string;
  type: RelationshipType;

  // Precise start date
  startYear?: number | null;
  startMonth?: number | null;
  startDay?: number | null;

  // Precise end date
  endYear?: number | null;
  endMonth?: number | null;
  endDay?: number | null;

  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  githubId: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GenerationRange {
  ancestors: number;     // Generations above center (default: 2)
  descendants: number;   // Generations below center (default: 3)
}

export interface FilterState {
  genders: Gender[];
  relationshipTypes: RelationshipType[];
  branchId: string | null;
  searchQuery: string;
  showPrivate: boolean;
}

// Graph visualization types
export interface GraphNode {
  id: string;
  name: string;
  gender: Gender;
  avatar?: string | null;
  relativeGeneration?: number;
  isPrivate?: boolean;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
}

export interface GraphLink {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  type: RelationshipType;
}

// Form data types
export interface PersonFormData {
  name: string;
  courtesyName?: string;
  artName?: string;
  gender: Gender;

  birthYear?: number | null;
  birthMonth?: number | null;
  birthDay?: number | null;

  deathYear?: number | null;
  deathMonth?: number | null;
  deathDay?: number | null;

  avatar?: string | null;
  isPrivate: boolean;
}

export interface RelationshipFormData {
  personAId: string;
  personBId: string;
  type: RelationshipType;

  startYear?: number | null;
  startMonth?: number | null;
  startDay?: number | null;

  endYear?: number | null;
  endMonth?: number | null;
  endDay?: number | null;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AvatarUploadResponse {
  success: boolean;
  avatar: string;  // Base64 data URL
  cropSuggestion: {
    x: number;      // 0-100 percentage
    y: number;      // 0-100 percentage
    width: number;  // 0-100 percentage
    height: number; // 0-100 percentage
  };
  originalSize: number;
  processedSize: number;
}

// Zod validation schemas
import { z } from 'zod';

export const personSchema = z.object({
  name: z.string().min(1, 'name is required'),
  courtesyName: z.string().optional(),
  artName: z.string().optional(),
  gender: z.nativeEnum(Gender),
  birthYear: z.number().int().min(0).max(2100).nullable().optional(),
  birthMonth: z.number().int().min(1).max(12).nullable().optional(),
  birthDay: z.number().int().min(1).max(31).nullable().optional(),
  deathYear: z.number().int().min(0).max(2100).nullable().optional(),
  deathMonth: z.number().int().min(1).max(12).nullable().optional(),
  deathDay: z.number().int().min(1).max(31).nullable().optional(),
  avatar: z.string().nullable().optional(),
  isPrivate: z.boolean().default(false),
});

export const relationshipSchema = z.object({
  personAId: z.string().min(1, 'person A is required'),
  personBId: z.string().min(1, 'person B is required'),
  type: z.nativeEnum(RelationshipType),
  startYear: z.number().int().min(0).max(2100).nullable().optional(),
  startMonth: z.number().int().min(1).max(12).nullable().optional(),
  startDay: z.number().int().min(1).max(31).nullable().optional(),
  endYear: z.number().int().min(0).max(2100).nullable().optional(),
  endMonth: z.number().int().min(1).max(12).nullable().optional(),
  endDay: z.number().int().min(1).max(31).nullable().optional(),
});
