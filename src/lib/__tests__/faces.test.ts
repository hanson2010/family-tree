// @vitest-environment node
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { normalizeAvatar } from '../faces';

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
