import sharp from 'sharp';
import { z } from 'zod';
import { GeminiCallError, generateJson, imagePart } from '@/lib/gemini';
import type { GeminiIssue } from '@/types';

/** Longest side of the copy sent to Gemini and cropped from */
const WORKING_SIZE = 1600;
const AVATAR_SIZE = 256;
/** A crop is this many times the face box, to include hair and chin */
const FACE_MARGIN = 1.7;
const MAX_FACES = 30;

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const FACES_PROMPT = `Find every human face in this photo, including small, partly turned and partly
hidden faces, and faces in paintings or old photographs. Give each face's bounding box as box_2d:
[ymin, xmin, ymax, xmax], each normalized to 0-1000. Return an empty list if there are no faces.`;

const facesSchema = {
  type: 'object',
  properties: {
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

async function detectFaces(image: Buffer, width: number, height: number): Promise<Box[]> {
  const reply = facesReply.parse(await generateJson([{ text: FACES_PROMPT }, imagePart(image, 'image/jpeg')], facesSchema));
  return reply.faces
    .map(({ box_2d: [ymin, xmin, ymax, xmax] }) => ({
      left: (Math.min(xmin, xmax) / 1000) * width,
      top: (Math.min(ymin, ymax) / 1000) * height,
      width: (Math.abs(xmax - xmin) / 1000) * width,
      height: (Math.abs(ymax - ymin) / 1000) * height,
    }))
    .filter((b) => b.width >= 8 && b.height >= 8)
    .sort((a, b) => a.left - b.left)
    .slice(0, MAX_FACES);
}

/** Largest square around the box center that stays inside the image */
function squareAround(box: Box, width: number, height: number): Box {
  const cx = box.left + box.width / 2;
  // Faces sit slightly above the middle of a portrait
  const cy = box.top + box.height * 0.45;
  const side = Math.min(Math.max(box.width, box.height) * FACE_MARGIN, width, height);
  const left = Math.min(Math.max(cx - side / 2, 0), width - side);
  const top = Math.min(Math.max(cy - side / 2, 0), height - side);
  return { left, top, width: side, height: side };
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
    const side = Math.min(width, height);
    const middle = { left: (width - side) / 2, top: (height - side) / 2, width: side, height: side };
    return { avatars: [await cropAvatar(data, middle)], detected: false, geminiIssue: issue };
  }
  const avatars = await Promise.all(boxes.map((box) => cropAvatar(data, squareAround(box, width, height))));
  return { avatars, detected: true };
}
