import { McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  ServiceError,
  createPerson,
  createRelationship,
  deletePerson,
  deleteRelationship,
  getVisiblePerson,
  getVisibleRelationship,
  listVisiblePersons,
  listSavedFaces,
  listVisibleRelationships,
  setPersonAvatar,
  updatePerson,
  updateRelationship,
  useSavedFace,
} from '@/lib/family-service';
import { aliases } from '@/lib/person-identity';
import { fetchPublicImage } from '@/lib/safe-fetch';
import { createUploadCode } from '@/lib/avatar-uploads';
import type { Person, Relationship } from '@/types';
import { Gender, RelationshipType } from '@/types';

/**
 * MCP tools for reading and changing the family tree as one user (the owner of the API token).
 * Every tool calls the same rules as the app: ownership, privacy and duplicate checks.
 */

const GENDERS = { male: Gender.MALE, female: Gender.FEMALE, unknown: Gender.UNKNOWN } as const;
const GENDER_NAMES = Object.fromEntries(Object.entries(GENDERS).map(([k, v]) => [v, k])) as Record<Gender, keyof typeof GENDERS>;

const TYPES = {
  PARENT_CHILD: RelationshipType.PARENT_CHILD,
  ADOPTIVE_PARENT: RelationshipType.ADOPTIVE_PARENT,
  FOSTER_PARENT: RelationshipType.FOSTER_PARENT,
  SPOUSE: RelationshipType.SPOUSE,
  CONCUBINE: RelationshipType.CONCUBINE,
  BETROTHED: RelationshipType.BETROTHED,
  SIBLING: RelationshipType.SIBLING,
  HALF_SIBLING: RelationshipType.HALF_SIBLING,
  SWORN_SIBLING: RelationshipType.SWORN_SIBLING,
} as const;
const TYPE_NAMES = Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [v, k])) as Record<RelationshipType, keyof typeof TYPES>;

const TYPE_HELP = `Relationship types (person A, person B):
PARENT_CHILD, ADOPTIVE_PARENT, FOSTER_PARENT: A is the parent, B the child.
SPOUSE, CONCUBINE, BETROTHED: a couple; for CONCUBINE the concubine is the woman. The order of a
married couple is normalized when stored (the woman first), so either order is accepted.
SIBLING, HALF_SIBLING, SWORN_SIBLING: siblings, either order.`;

const year = z.number().int().min(0).max(2100);
const month = z.number().int().min(1).max(12);
const day = z.number().int().min(1).max(31);

const personFields = {
  name: z.string().min(1).describe('Full name, e.g. 蒋中正'),
  courtesyName: z.string().optional().describe('字 (courtesy name)'),
  artName: z.string().optional().describe('号 (art name)'),
  gender: z.enum(['male', 'female', 'unknown']),
  birthYear: year.nullable().optional().describe('Gregorian year'),
  birthMonth: month.nullable().optional(),
  birthDay: day.nullable().optional(),
  deathYear: year.nullable().optional().describe('Gregorian year'),
  deathMonth: month.nullable().optional(),
  deathDay: day.nullable().optional(),
  isPrivate: z.boolean().optional().describe('Private persons are visible only to you; default false (public)'),
};

const dateFields = {
  startYear: year.nullable().optional().describe('Start of the relationship, e.g. the wedding year'),
  startMonth: month.nullable().optional(),
  startDay: day.nullable().optional(),
  endYear: year.nullable().optional(),
  endMonth: month.nullable().optional(),
  endDay: day.nullable().optional(),
};

/** A person without the avatar image, which is large and of no use to an agent */
function personSummary(p: Person, userId: string) {
  return {
    id: p.id,
    name: p.name,
    courtesyName: p.courtesyName || undefined,
    artName: p.artName || undefined,
    gender: GENDER_NAMES[p.gender] ?? 'unknown',
    birth: [p.birthYear, p.birthMonth, p.birthDay].filter((v) => v != null).join('-') || undefined,
    death: [p.deathYear, p.deathMonth, p.deathDay].filter((v) => v != null).join('-') || undefined,
    isPrivate: p.isPrivate,
    yours: p.createdBy === userId,
    hasAvatar: !!p.avatar,
  };
}

function relationshipSummary(r: Relationship, names: Map<string, string>) {
  return {
    id: r.id,
    type: TYPE_NAMES[r.type] ?? r.type,
    personA: { id: r.personAId, name: names.get(r.personAId) },
    personB: { id: r.personBId, name: names.get(r.personBId) },
    start: [r.startYear, r.startMonth, r.startDay].filter((v) => v != null).join('-') || undefined,
    end: [r.endYear, r.endMonth, r.endDay].filter((v) => v != null).join('-') || undefined,
  };
}

const ok = (value: unknown): CallToolResult => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] });

/** A refused request becomes a tool error the agent can read and correct */
function failure(error: unknown): CallToolResult {
  if (error instanceof ServiceError) return { isError: true, content: [{ type: 'text', text: error.message }] };
  console.error('MCP tool failed:', error);
  return { isError: true, content: [{ type: 'text', text: 'The operation failed.' }] };
}

/** Run a tool and return its result as JSON text */
async function run(work: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return ok(await work());
  } catch (error) {
    return failure(error);
  }
}

/** A stored avatar (a data: URL) as MCP image content */
function imageContent(dataUrl: string) {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  return { type: 'image' as const, mimeType: match?.[1] ?? 'image/jpeg', data: match?.[2] ?? '' };
}

/** Largest image fetched for an avatar */
const MAX_AVATAR_BYTES = 10 * 1024 * 1024;

export function createFamilyTreeServer(userId: string): McpServer {
  const server = new McpServer(
    { name: 'family-tree', version: '1.0.0' },
    {
      instructions: `A family tree with Chinese kinship. You act as one user: you can read public persons and
the user's own persons, and change only the user's own persons and relationships. Look persons up
with search_persons before creating them; creating a public person that matches an existing one
(same name, or a name matching another's 字/号, with no conflicting birth date) is refused.`,
    }
  );

  const nameMap = async () => new Map((await listVisiblePersons(userId)).map((p) => [p.id, p.name]));

  server.registerTool(
    'search_persons',
    {
      title: 'Search persons',
      description: 'Find persons whose name, 字 or 号 contains the query (empty query lists everyone, up to the limit).',
      inputSchema: z.object({
        query: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional().describe('Default 50'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ query, limit }) =>
      run(async () => {
        const q = query?.trim().toLowerCase() ?? '';
        const matches = (await listVisiblePersons(userId)).filter(
          (p) => !q || aliases(p).some((name) => name.toLowerCase().includes(q))
        );
        return {
          total: matches.length,
          persons: matches.slice(0, limit ?? 50).map((p) => personSummary(p, userId)),
        };
      })
  );

  server.registerTool(
    'get_person',
    {
      title: 'Get a person',
      description: 'One person with all of their relationships.',
      inputSchema: z.object({ id: z.string() }),
      annotations: { readOnlyHint: true },
    },
    async ({ id }) =>
      run(async () => {
        const person = await getVisiblePerson(id, userId);
        const names = await nameMap();
        const relationships = await listVisibleRelationships(userId, id);
        return {
          person: personSummary(person, userId),
          relationships: relationships.map((r) => relationshipSummary(r, names)),
        };
      })
  );

  server.registerTool(
    'create_person',
    {
      title: 'Create a person',
      description: 'Add a person. Refused when public and matching an existing person; search first.',
      inputSchema: z.object(personFields),
    },
    async (input) =>
      run(async () => {
        const person = await createPerson(userId, {
          ...input,
          gender: GENDERS[input.gender],
          isPrivate: input.isPrivate ?? false,
        });
        return personSummary(person, userId);
      })
  );

  server.registerTool(
    'update_person',
    {
      title: 'Update a person',
      description: 'Change details of one of your persons. Fields left out keep their value; null clears a date part.',
      inputSchema: z.object({ id: z.string(), ...personFields, name: personFields.name.optional(), gender: personFields.gender.optional() }),
      annotations: { idempotentHint: true },
    },
    async ({ id, ...changes }) =>
      run(async () => {
        const current = await getVisiblePerson(id, userId);
        const pick = <K extends keyof Person>(key: K, value: Person[K] | undefined) => (value === undefined ? current[key] : value);
        const person = await updatePerson(userId, id, {
          name: pick('name', changes.name),
          courtesyName: pick('courtesyName', changes.courtesyName) ?? '',
          artName: pick('artName', changes.artName) ?? '',
          gender: changes.gender ? GENDERS[changes.gender] : current.gender,
          birthYear: pick('birthYear', changes.birthYear),
          birthMonth: pick('birthMonth', changes.birthMonth),
          birthDay: pick('birthDay', changes.birthDay),
          deathYear: pick('deathYear', changes.deathYear),
          deathMonth: pick('deathMonth', changes.deathMonth),
          deathDay: pick('deathDay', changes.deathDay),
          avatar: current.avatar ?? null,
          isPrivate: pick('isPrivate', changes.isPrivate),
        });
        return personSummary(person, userId);
      })
  );

  server.registerTool(
    'delete_person',
    {
      title: 'Delete a person',
      description: 'Delete one of your persons and all of their relationships. Cannot be undone.',
      inputSchema: z.object({ id: z.string() }),
      annotations: { destructiveHint: true },
    },
    async ({ id }) => run(async () => ({ deleted: id, ...(await deletePerson(userId, id)) }))
  );

  server.registerTool(
    'get_person_avatar',
    {
      title: 'Get a person’s avatar',
      description: 'The avatar image of a person you can see, as a 256×256 JPEG.',
      inputSchema: z.object({ id: z.string() }),
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      try {
        const person = await getVisiblePerson(id, userId);
        if (!person.avatar) return ok({ id, name: person.name, avatar: null });
        return { content: [{ type: 'text', text: `Avatar of ${person.name}` }, imageContent(person.avatar)] };
      } catch (error) {
        return failure(error);
      }
    }
  );

  server.registerTool(
    'set_person_avatar',
    {
      title: 'Set a person’s avatar',
      description:
        'Give one of your persons an avatar from an image on the web: the server fetches the https:// address (JPEG, PNG, GIF or WebP, up to 10MB), scales it so its short edge is 256px and keeps the middle square. For an image file on this computer, use prepare_avatar_upload instead.',
      inputSchema: z.object({
        id: z.string(),
        url: z.string().min(1).describe('https:// address of the image'),
      }),
      annotations: { idempotentHint: true, openWorldHint: true },
    },
    async ({ id, url }) =>
      run(async () => {
        let image: Buffer;
        try {
          image = await fetchPublicImage(url, MAX_AVATAR_BYTES);
        } catch (error) {
          throw new ServiceError(400, error instanceof Error ? error.message : 'The image could not be fetched.');
        }
        return personSummary(await setPersonAvatar(userId, id, image), userId);
      })
  );

  server.registerTool(
    'prepare_avatar_upload',
    {
      title: 'Prepare an avatar upload from a local file',
      description:
        'For an image file on this computer: returns a one-time upload link and a curl command. Run the command with the file path filled in; the file goes straight to the server and is used as the person’s avatar (scaled so its short edge is 256px, middle square kept). The link works for one upload to this person, for 10 minutes, and contains no API token.',
      inputSchema: z.object({ personId: z.string() }),
    },
    async ({ personId }) =>
      run(async () => {
        const { uploadUrl, expiresAt } = await createUploadCode(userId, personId);
        return {
          uploadUrl,
          expiresAt,
          command: `curl -F "file=@<path to the image file>" "${uploadUrl}"`,
          note: 'Replace <path to the image file> with the local path, keeping the @. JPEG, PNG, GIF or WebP, up to 10MB.',
        };
      })
  );

  server.registerTool(
    'remove_person_avatar',
    {
      title: 'Remove a person’s avatar',
      description: 'Remove the avatar of one of your persons. Cannot be undone.',
      inputSchema: z.object({ id: z.string() }),
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async ({ id }) => run(async () => personSummary(await setPersonAvatar(userId, id, null), userId))
  );

  server.registerTool(
    'list_saved_faces',
    {
      title: 'List saved faces',
      description:
        'Your faces saved from group photos and not yet used, newest first, each as an image with its id. Give one to a person with use_saved_face.',
      inputSchema: z.object({ limit: z.number().int().min(1).max(30).optional().describe('Default 12') }),
      annotations: { readOnlyHint: true },
    },
    async ({ limit }) => {
      try {
        const faces = await listSavedFaces(userId);
        const shown = faces.slice(0, limit ?? 12);
        return {
          content: [
            { type: 'text', text: `${faces.length} saved faces; showing ${shown.length}, newest first.` },
            ...shown.flatMap((face) => [{ type: 'text' as const, text: `Saved face id: ${face.id}` }, imageContent(face.image)]),
          ],
        };
      } catch (error) {
        return failure(error);
      }
    }
  );

  server.registerTool(
    'use_saved_face',
    {
      title: 'Use a saved face as an avatar',
      description: 'Give one of your persons one of your saved faces as their avatar; the face leaves the saved list.',
      inputSchema: z.object({ personId: z.string(), faceId: z.string() }),
    },
    async ({ personId, faceId }) => run(async () => personSummary(await useSavedFace(userId, personId, faceId), userId))
  );

  server.registerTool(
    'create_relationship',
    {
      title: 'Create a relationship',
      description: `Link two persons. If the same relationship exists already, it is returned instead.\n${TYPE_HELP}`,
      inputSchema: z.object({
        personAId: z.string(),
        personBId: z.string(),
        type: z.enum(Object.keys(TYPES) as [keyof typeof TYPES, ...(keyof typeof TYPES)[]]),
        ...dateFields,
      }),
    },
    async ({ type, ...input }) =>
      run(async () => {
        const { relationship, existed } = await createRelationship(userId, { ...input, type: TYPES[type] });
        return { existed, relationship: relationshipSummary(relationship, await nameMap()) };
      })
  );

  server.registerTool(
    'update_relationship',
    {
      title: 'Update a relationship',
      description: `Change the type or dates of one of your relationships. Fields left out keep their value.\n${TYPE_HELP}`,
      inputSchema: z.object({
        id: z.string(),
        type: z.enum(Object.keys(TYPES) as [keyof typeof TYPES, ...(keyof typeof TYPES)[]]).optional(),
        ...dateFields,
      }),
      annotations: { idempotentHint: true },
    },
    async ({ id, type, ...dates }) =>
      run(async () => {
        const current = await getVisibleRelationship(id, userId);
        const pick = <K extends keyof Relationship>(key: K, value: Relationship[K] | undefined) =>
          value === undefined ? current[key] : value;
        const relationship = await updateRelationship(userId, id, {
          personAId: current.personAId,
          personBId: current.personBId,
          type: type ? TYPES[type] : current.type,
          startYear: pick('startYear', dates.startYear),
          startMonth: pick('startMonth', dates.startMonth),
          startDay: pick('startDay', dates.startDay),
          endYear: pick('endYear', dates.endYear),
          endMonth: pick('endMonth', dates.endMonth),
          endDay: pick('endDay', dates.endDay),
        });
        return relationshipSummary(relationship, await nameMap());
      })
  );

  server.registerTool(
    'delete_relationship',
    {
      title: 'Delete a relationship',
      description: 'Delete one of your relationships. Cannot be undone.',
      inputSchema: z.object({ id: z.string() }),
      annotations: { destructiveHint: true },
    },
    async ({ id }) =>
      run(async () => {
        await deleteRelationship(userId, id);
        return { deleted: id };
      })
  );

  return server;
}
