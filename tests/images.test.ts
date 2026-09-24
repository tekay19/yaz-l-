import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { ImageError, normalizeImage } from '@/lib/images';

describe('normalizeImage', () => {
  it('shrinks a large photo to a 1568px JPEG', async () => {
    const big = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: '#fff' } }).png().toBuffer();
    const out = await normalizeImage(big);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('jpeg');
    expect(Math.max(meta.width!, meta.height!)).toBe(1568);
  });
  it('rejects bytes that are not an image', async () => {
    await expect(normalizeImage(Buffer.from('not an image'))).rejects.toBeInstanceOf(ImageError);
  });

  // Düzeltme.md D3: sharp's prebuilt build decodes AVIF but not HEIC, so HEIC
  // bytes must be routed to the HEIC decoder first. A header that claims HEIC
  // but carries no image has to fail with the HEIC-specific advice; if the
  // bytes went straight to sharp the teacher would get the generic message.
  it('routes HEIC bytes to the HEIC decoder and explains a failed decode', async () => {
    const fakeHeic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), Buffer.alloc(16)]);
    const err = await normalizeImage(fakeHeic).catch((e) => e);
    expect(err).toBeInstanceOf(ImageError);
    expect(err.message).toMatch(/HEIC/);
  });
});
