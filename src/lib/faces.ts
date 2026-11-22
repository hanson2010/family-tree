import sharp from 'sharp';
import { z } from 'zod';
import { GeminiCallError, generateJson, imagePart } from '@/lib/gemini';
import type { GeminiIssue } from '@/types';

/**
 * Longest side of the copy sent to Gemini and cropped from: large enough for the faces in a group
 * photo, small enough to keep each photo to one inexpensive call
 */
const WORKING_SIZE = 2048;
const AVATAR_SIZE = 256;
/** A crop is up to this many times the face box, to include hair and chin */
const FACE_MARGIN = 1.7;
const MAX_FACES = 60;

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const FACES_PROMPT = `This is a photo, often a group photo. First count the people whose faces can
be seen, row by row: in front, behind and at the edges, including small, partly turned, partly
hidden and blurred faces, children, and faces in paintings or old photographs. Then give one
bounding box per face as box_2d: [ymin, xmin, ymax, xmax], each normalized to 0-1000, so that the
number of boxes equals your count. Each box covers one face from the hairline to the chin and ear
to ear, never more than one person. Return count 0 and an empty list if there are no faces.`;

const facesSchema = {
  type: 'object',
  properties: {
    count: { type: 'integer' },
    faces: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          box_2d: { type: 'array', items: { type: 'integer' }, minItems: 4, maxItems: 4 },
        },
        required: ['box_2d'],
      },
    },
  },
  required: ['faces'],
};

const facesReply = z.object({
  faces: z.array(z.object({ box_2d: z.array(z.number()).length(4) })),
});

/** Upright JPEG copy of the image, no larger than the working size */
async function workingCopy(file: Buffer) {
  const { data, info } = await sharp(file)
    .rotate()
    .resize(WORKING_SIZE, WORKING_SIZE, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 90 })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Faces in one image, in that image's pixels */
async function detectIn(image: Buffer, width: number, height: number): Promise<Box[]> {
  const reply = facesReply.parse(
    await generateJson(
      [{ text: FACES_PROMPT }, imagePart(image, 'image/jpeg')],
      facesSchema,
      undefined,
      process.env.GOOGLE_AI_FACES_MODEL
    )
  );
  return reply.faces
    .map(({ box_2d: [ymin, xmin, ymax, xmax] }) => ({
      left: (Math.min(xmin, xmax) / 1000) * width,
      top: (Math.min(ymin, ymax) / 1000) * height,
      width: (Math.abs(xmax - xmin) / 1000) * width,
      height: (Math.abs(ymax - ymin) / 1000) * height,
    }))
    .filter((b) => b.width >= 8 && b.height >= 8);
}

/** Every face in the working copy, in one Gemini call, in reading order */
async function detectFaces(image: Buffer, width: number, height: number): Promise<Box[]> {
  return readingOrder(await detectIn(image, width, height)).slice(0, MAX_FACES);
}

/** Faces row by row, left to right; faces whose centres are within a face height share a row */
export function readingOrder(faces: Box[]): Box[] {
  if (faces.length === 0) return faces;
  const heights = faces.map((f) => f.height).sort((a, b) => a - b);
  const rowHeight = heights[Math.floor(heights.length / 2)];
  const byCentre = [...faces].sort((a, b) => a.top + a.height / 2 - (b.top + b.height / 2));
  const rows: Box[][] = [];
  for (const face of byCentre) {
    const centre = face.top + face.height / 2;
    const row = rows[rows.length - 1];
    const rowCentre = row && row[0].top + row[0].height / 2;
    if (row && centre - rowCentre < rowHeight) row.push(face);
    else rows.push([face]);
  }
  return rows.flatMap((row) => row.sort((a, b) => a.left - b.left));
}

/**
 * A square crop around each face, inside the image: the face with a margin for hair and chin,
 * made smaller where it would reach into another face, but never smaller than the face itself.
 */
export function cropSquares(boxes: Box[], width: number, height: number): Box[] {
  return boxes.map((box, i) => {
    const cx = box.left + box.width / 2;
    // Faces sit slightly above the middle of a portrait
    const cy = box.top + box.height * 0.45;
    const face = Math.max(box.width, box.height);
    let half = (face * FACE_MARGIN) / 2;
    boxes.forEach((other, j) => {
      if (j === i) return;
      // A square of half-side h reaches into the other face when h exceeds the distance from the
      // centre to that face on both axes
      const dx = Math.max(other.left - cx, cx - (other.left + other.width), 0);
      const dy = Math.max(other.top - cy, cy - (other.top + other.height), 0);
      half = Math.min(half, Math.max(dx, dy));
    });
    const side = Math.min(Math.max(half * 2, face), width, height);
    const left = Math.min(Math.max(cx - side / 2, 0), width - side);
    const top = Math.min(Math.max(cy - side / 2, 0), height - side);
    return { left, top, width: side, height: side };
  });
}

async function cropAvatar(image: Buffer, square: Box): Promise<string> {
  const jpeg = await sharp(image)
    .extract({
      left: Math.round(square.left),
      top: Math.round(square.top),
      width: Math.max(1, Math.round(square.width)),
      height: Math.max(1, Math.round(square.height)),
    })
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
    .jpeg({ quality: 85 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

/** Largest data URL accepted back from the browser */
const MAX_AVATAR_DATA_URL = 512 * 1024;

/**
 * A browser-supplied avatar, decoded and re-encoded as a square JPEG of the avatar size.
 * Throws when it is not a readable image.
 */
export async function normalizeAvatar(dataUrl: string): Promise<string> {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match || dataUrl.length > MAX_AVATAR_DATA_URL) throw new Error('Not an avatar image');
  const jpeg = await sharp(Buffer.from(match[2], 'base64'))
    .rotate()
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 85 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

/**
 * Square avatars of every face in a photo, left to right. When Gemini finds no face or
 * cannot be reached, the result is one square from the middle of the photo.
 */
export async function avatarsFromPhoto(
  file: Buffer
): Promise<{ avatars: string[]; detected: boolean; geminiIssue?: GeminiIssue }> {
  const { data, width, height } = await workingCopy(file);
  let boxes: Box[] = [];
  let issue: GeminiIssue | undefined;
  try {
    boxes = await detectFaces(data, width, height);
  } catch (error) {
    console.warn('Face detection failed, using the middle of the photo:', error);
    issue = error instanceof GeminiCallError ? error.issue : 'failed';
  }
  if (boxes.length === 0) {
    return { avatars: [await cropAvatar(data, middleSquare(width, height))], detected: false, geminiIssue: issue };
  }
  const avatars = await Promise.all(cropSquares(boxes, width, height).map((square) => cropAvatar(data, square)));
  return { avatars, detected: true };
}

/** The largest square in the middle of an image */
function middleSquare(width: number, height: number): Box {
  const side = Math.min(width, height);
  return { left: (width - side) / 2, top: (height - side) / 2, width: side, height: side };
}

/**
 * A square avatar without looking for faces: the photo is scaled so its short edge is the avatar
 * size, then the middle square of that size is cut out.
 */
export async function centeredAvatar(file: Buffer): Promise<string> {
  const jpeg = await sharp(file)
    .rotate()
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'centre' })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 85 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}
