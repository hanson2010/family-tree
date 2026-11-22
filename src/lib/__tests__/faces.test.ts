// @vitest-environment node
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { centeredAvatar, cropSquares, normalizeAvatar, readingOrder, type Box } from '../faces';

const face = (left: number, top: number, size = 40): Box => ({ left, top, width: size, height: size });
/** Whether a crop reaches into a face box */
const reaches = (crop: Box, other: Box) =>
  crop.left < other.left + other.width &&
  crop.left + crop.width > other.left &&
  crop.top < other.top + other.height &&
  crop.top + crop.height > other.top;

describe('cropSquares', () => {
  it('adds a margin around a lone face', () => {
    const [crop] = cropSquares([face(500, 300)], 1600, 1200);
    expect(crop.width).toBeCloseTo(68);
    expect(crop.width).toBe(crop.height);
  });

  it('keeps each crop out of its neighbours’ faces in a group photo', () => {
    // A row of faces 50px apart with 40px faces: a 1.4× crop (56px) would reach the next face
    const row = [face(100, 300), face(150, 300), face(200, 302), face(250, 298)];
    const crops = cropSquares(row, 1600, 1200);
    crops.forEach((crop, i) => row.forEach((other, j) => i !== j && expect(reaches(crop, other)).toBe(false)));
    crops.forEach((crop) => expect(crop.width).toBeGreaterThanOrEqual(40));
  });

  it('never makes a crop smaller than the face, even when faces overlap', () => {
    const crops = cropSquares([face(100, 100, 60), face(130, 110, 60)], 1600, 1200);
    crops.forEach((crop) => expect(crop.width).toBe(60));
  });

  it('keeps crops inside the image', () => {
    const [crop] = cropSquares([face(0, 0, 50)], 300, 200);
    expect(crop.left).toBeGreaterThanOrEqual(0);
    expect(crop.top).toBeGreaterThanOrEqual(0);
  });
});

const pngDataUrl = async (width: number, height: number) => {
  const png = await sharp({ create: { width, height, channels: 3, background: '#c33' } }).png().toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
};

describe('normalizeAvatar', () => {
  it('re-encodes an image as a 256×256 JPEG', async () => {
    const result = await normalizeAvatar(await pngDataUrl(300, 200));
    expect(result.startsWith('data:image/jpeg;base64,')).toBe(true);
    const meta = await sharp(Buffer.from(result.split(',')[1], 'base64')).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 256, 256]);
  });

  it('rejects anything that is not an image data URL', async () => {
    await expect(normalizeAvatar('https://example.com/a.jpg')).rejects.toThrow();
    await expect(normalizeAvatar('data:image/svg+xml;base64,PHN2Zz4=')).rejects.toThrow();
    await expect(normalizeAvatar('data:image/png;base64,bm90IGFuIGltYWdl')).rejects.toThrow();
  });

  it('rejects oversized data', async () => {
    await expect(normalizeAvatar(`data:image/png;base64,${'A'.repeat(600 * 1024)}`)).rejects.toThrow();
  });
});

describe('centeredAvatar', () => {
  it('scales the short edge to 256 and keeps the middle square', async () => {
    // 600×300: left third red, middle third green, right third blue
    const third = (color: string) => sharp({ create: { width: 200, height: 300, channels: 3, background: color } }).png().toBuffer();
    const photo = await sharp({ create: { width: 600, height: 300, channels: 3, background: '#000' } })
      .composite([
        { input: await third('#f00'), left: 0, top: 0 },
        { input: await third('#0f0'), left: 200, top: 0 },
        { input: await third('#00f'), left: 400, top: 0 },
      ])
      .png()
      .toBuffer();
    const avatar = Buffer.from((await centeredAvatar(photo)).split(',')[1], 'base64');
    const { data, info } = await sharp(avatar).raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([256, 256]);
    // Scaled to 512×256, the middle 256 columns are mostly green, with a little red and blue at the sides
    const pixel = (x: number) => Array.from(data.subarray((128 * 256 + x) * 3, (128 * 256 + x) * 3 + 3));
    expect(pixel(128)[1]).toBeGreaterThan(200);
    expect(pixel(2)[0]).toBeGreaterThan(200);
    expect(pixel(253)[2]).toBeGreaterThan(200);
  });
});

describe('readingOrder', () => {
  it('orders faces row by row, left to right, despite small height differences', () => {
    const a = face(300, 105), b = face(100, 100), c = face(200, 95), d = face(150, 200);
    expect(readingOrder([a, b, c, d])).toEqual([b, c, a, d]);
  });
});
