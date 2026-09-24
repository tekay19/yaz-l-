import sharp from 'sharp';
import convert from 'heic-convert';

export class ImageError extends Error {}

const LONG_EDGE = 1568; // Claude's recommended long edge; bigger costs more and reads no better

function isHeif(bytes: Buffer): boolean {
  if (bytes.length < 12 || bytes.toString('ascii', 4, 8) !== 'ftyp') return false;
  const brand = bytes.toString('ascii', 8, 12);
  return ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand);
}

// sharp's prebuilt binaries cannot decode HEIC (the HEVC codec is
// patent-encumbered and left out of the default build), but iPhones save
// photos in it by default — so convert with a pure-JS decoder first, and the
// rest of the pipeline never has to know the photo came from an iPhone.
async function toJpegIfHeic(input: Buffer): Promise<Buffer> {
  if (!isHeif(input)) return input;
  try {
    return Buffer.from(await convert({ buffer: input, format: 'JPEG', quality: 0.92 }));
  } catch {
    throw new ImageError('HEIC fotoğraf açılamadı. Kamera ayarından "En Uyumlu" (JPEG) formatını seçip tekrar deneyin.');
  }
}

export async function normalizeImage(rawInput: Buffer): Promise<Buffer> {
  const input = await toJpegIfHeic(rawInput);
  try {
    return await sharp(input, { failOn: 'error' })
      .rotate() // honour EXIF orientation from phone cameras
      .resize({ width: LONG_EDGE, height: LONG_EDGE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    throw new ImageError('Fotoğraf açılamadı. JPEG veya PNG olarak yükleyin.');
  }
}
