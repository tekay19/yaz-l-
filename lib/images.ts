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

// A photo the model cannot read reliably is refused at upload, while the
// teacher still has the sheet in hand, instead of being read confidently
// wrong. Thresholds come from the synthetic set (scripts/synth-sheets.ts) and
// sit well clear of mildly blurred or dim photos, which still read correctly.
export const MIN_LONG_EDGE = 1000;  // px after EXIF rotation; 560-760 px shots caused most silent misreads
const MIN_BRIGHTNESS = 60;          // mean grey 0-255; dim rooms measure ~110, unreadable ~40
const MIN_SHARPNESS = 5;            // Laplacian std-dev at 1000 px; mild blur ~13, unreadable ~1.5

export async function checkPhoto(normalized: Buffer): Promise<void> {
  const meta = await sharp(normalized).metadata();
  if (Math.max(meta.width ?? 0, meta.height ?? 0) < MIN_LONG_EDGE) {
    throw new ImageError('Fotoğraf çok küçük. Kâğıdı daha yakından ve telefonun kendi kamerasıyla çekin (mesajlaşma uygulamasından değil).');
  }
  const grey = sharp(normalized).greyscale().resize({ width: 1000, height: 1000, fit: 'inside' });
  const { channels } = await grey.clone().stats();
  if (channels[0].mean < MIN_BRIGHTNESS) {
    throw new ImageError('Fotoğraf çok karanlık. Daha aydınlık bir yerde tekrar çekin.');
  }
  const edges = await grey.clone()
    .convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0], offset: 128 })
    .raw().toBuffer();
  let sum = 0;
  let sq = 0;
  for (const v of edges) { sum += v; sq += v * v; }
  const mean = sum / edges.length;
  if (Math.sqrt(sq / edges.length - mean * mean) < MIN_SHARPNESS) {
    throw new ImageError('Fotoğraf bulanık. Telefonu sabit tutup kâğıda odaklanarak tekrar çekin.');
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
