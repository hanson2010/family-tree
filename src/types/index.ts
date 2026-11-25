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
// Core Interfaces
export interface Person {
  id: string;
  name: string;
  courtesyName?: string;  // zi (character) - Chinese: zi
  artName?: string;       // hao (art name) - Chinese: hao
  /** Other full names (别名, 小名, …), sorted by pinyin; missing on persons saved before it existed */
  otherNames?: string[];
  gender: Gender;

  // Precise birth date
  birthYear?: number | null;
  birthMonth?: number | null;
  birthDay?: number | null;

  // Precise death date
  deathYear?: number | null;
  deathMonth?: number | null;
  deathDay?: number | null;

  /** One web page about the person, e.g. on Wikipedia or 百度百科 */
  link?: string;
  /** Free-text notes about the person */
  description?: string;

  /**
   * Address of the avatar image (/api/persons/{id}/avatar?v=…, changing with the image), or null.
   * In a save request: a data: URL sets a new avatar, null removes it, and anything else (left
   * out, or the address sent back unchanged) keeps the current one.
   */
  avatar?: string | null;

  // Privacy control
  isPrivate: boolean;
  createdBy: string;

  /** ISO 8601 */
  createdAt: string;
  updatedAt: string;

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
  /** ISO 8601 */
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  /** Verified by Google or GitHub; used to link accounts with the same email */
  email: string | null;
  emailVerified?: boolean;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GenerationRange {
  ancestors: number;     // Generations above center (default: 2)
  descendants: number;   // Generations below center (default: 3)
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

// Form data types
export interface PersonFormData {
  name: string;
  courtesyName?: string;
  artName?: string;
  otherNames?: string[];
  gender: Gender;

  birthYear?: number | null;
  birthMonth?: number | null;
  birthDay?: number | null;

  deathYear?: number | null;
  deathMonth?: number | null;
  deathDay?: number | null;

  link?: string;
  description?: string;

  avatar?: string | null;
  isPrivate: boolean;
  /** A saved face used as the avatar; the server saves the person and removes the face together */
  savedAvatarId?: string;
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
  /** Why a Gemini call failed, when it did */
  geminiIssue?: GeminiIssue;
}

/**
 * Why a Gemini call failed: credits or billing used up, quota or rate limit reached, API key
 * missing or invalid, Gemini temporarily down, Gemini not reachable, or something else.
 */
export type GeminiIssue = 'billing' | 'quota' | 'key' | 'unavailable' | 'unreachable' | 'failed';

/** A face saved for later; only its creator sees it, until it is used for a person */
export interface SavedAvatar {
  id: string;
  /** Square JPEG data URL */
  image: string;
  createdBy: string;
  createdAt: Date;
}

export interface AvatarUploadResponse {
  success: boolean;
  /** Square JPEG data URLs, one per face, left to right */
  avatars: string[];
  /** False when no face was found and the single avatar is the middle of the photo */
  detected: boolean;
  /** Set when faces could not be looked for because the Gemini call failed */
  geminiIssue?: GeminiIssue;
}

// Zod validation schemas
import { z } from 'zod';
import { MAX_OTHER_NAMES, MAX_OTHER_NAME_LENGTH, normalizeOtherNames } from '@/lib/other-names';
import { MAX_DESCRIPTION_LENGTH, MAX_LINK_LENGTH, isWebUrl } from '@/lib/web-link';

export const personSchema = z.object({
  name: z.string().min(1, 'name is required'),
  courtesyName: z.string().optional(),
  artName: z.string().optional(),
  /** Stored trimmed, without repeats and sorted by pinyin; left out keeps a person's current ones */
  otherNames: z
    .array(z.string().max(MAX_OTHER_NAME_LENGTH))
    .max(MAX_OTHER_NAMES)
    .optional()
    .transform((names) => (names === undefined ? undefined : normalizeOtherNames(names))),
  gender: z.nativeEnum(Gender),
  birthYear: z.number().int().min(0).max(2100).nullable().optional(),
  birthMonth: z.number().int().min(1).max(12).nullable().optional(),
  birthDay: z.number().int().min(1).max(31).nullable().optional(),
  deathYear: z.number().int().min(0).max(2100).nullable().optional(),
  deathMonth: z.number().int().min(1).max(12).nullable().optional(),
  deathDay: z.number().int().min(1).max(31).nullable().optional(),
  /** An http(s) address; left out keeps a person's current link; '' clears it */
  link: z
    .string()
    .trim()
    .max(MAX_LINK_LENGTH)
    .refine((v) => v === '' || isWebUrl(v), 'link must be an http:// or https:// address')
    .optional(),
  /** Left out keeps a person's current description; '' clears it */
  description: z.string().trim().max(MAX_DESCRIPTION_LENGTH).optional(),
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
