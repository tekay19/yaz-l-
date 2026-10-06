import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { ImageError, checkPhoto, normalizeImage } from '@/lib/images';

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

// A printed sheet: dark lines and text on white, the kind of detail a readable
// photo keeps and a blurred one loses.
async function sheet(width: number, height: number) {
  let lines = '';
  for (let y = 60; y < height - 40; y += 40) {
    lines += `<line x1="40" y1="${y}" x2="${width - 40}" y2="${y}" stroke="#000" stroke-width="2"/>`;
    for (let x = 80; x < width - 80; x += 70) lines += `<circle cx="${x}" cy="${y + 20}" r="12" fill="none" stroke="#333" stroke-width="2"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fafafa"/>${lines}</svg>`;
  return sharp(Buffer.from(svg)).jpeg().toBuffer();
}

describe('checkPhoto', () => {
  it('accepts a sharp, bright photo of a sheet', async () => {
    await expect(checkPhoto(await normalizeImage(await sheet(1500, 2000)))).resolves.toBeUndefined();
  });
  it('refuses a photo too small to read every bubble', async () => {
    const err = await checkPhoto(await normalizeImage(await sheet(560, 740))).catch((e) => e);
    expect(err).toBeInstanceOf(ImageError);
    expect(err.message).toMatch(/küçük/);
  });
  it('refuses a photo taken in the dark', async () => {
    const dark = await sharp(await sheet(1500, 2000)).modulate({ brightness: 0.15 }).jpeg().toBuffer();
    const err = await checkPhoto(await normalizeImage(dark)).catch((e) => e);
    expect(err.message).toMatch(/karanlık/);
  });
  it('refuses a badly blurred photo but keeps a slightly soft one', async () => {
    const photo = await sheet(1500, 2000);
    const soft = await sharp(photo).blur(1.5).jpeg().toBuffer();
    await expect(checkPhoto(await normalizeImage(soft))).resolves.toBeUndefined();
    const blurred = await sharp(photo).blur(12).jpeg().toBuffer();
    const err = await checkPhoto(await normalizeImage(blurred)).catch((e) => e);
    expect(err.message).toMatch(/bulanık/);
  });
});

// A sheet on a dark desk, photographed from a distance: the sheet takes up
// only part of a large frame.
async function onDesk(sheetW: number, sheetH: number, frameW = 4000, frameH = 3000) {
  return sharp({ create: { width: frameW, height: frameH, channels: 3, background: '#5a4632' } })
    .composite([{ input: await sheet(sheetW, sheetH), left: 900, top: 400 }])
    .jpeg().toBuffer();
}

describe('a sheet photographed from afar', () => {
  it('is cut out of the frame, so its writing keeps its pixels', async () => {
    const out = await normalizeImage(await onDesk(1500, 2000));
    const meta = await sharp(out).metadata();
    // the sheet (3:4, standing) rather than the landscape desk
    expect(meta.height!).toBeGreaterThan(meta.width!);
    expect(meta.height).toBe(1568);
    await expect(checkPhoto(out)).resolves.toBeUndefined();
  });
  it('is refused when even cut out it is too small to read', async () => {
    const err = await checkPhoto(await normalizeImage(await onDesk(560, 740))).catch((e) => e);
    expect(err).toBeInstanceOf(ImageError);
    expect(err.message).toMatch(/yakından/);
  });
  it('leaves a close-up photo whole', async () => {
    const meta = await sharp(await normalizeImage(await sheet(1500, 2000))).metadata();
    expect([meta.width, meta.height]).toEqual([1176, 1568]);
  });
});
