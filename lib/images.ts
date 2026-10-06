import sharp, { type Region } from 'sharp';
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
    throw new ImageError('Kâğıt fotoğrafta çok küçük. Kâğıdı ekranı dolduracak kadar yakından, telefonun kendi kamerasıyla çekin (mesajlaşma uygulamasından gelen fotoğraf küçülmüş olur).');
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

// A sheet photographed from across the desk is a small bright rectangle in a
// big frame: shrunk to LONG_EDGE as a whole, its handwriting would be a few
// pixels high. Find the sheet — the largest bright, roughly rectangular
// region — and keep only it. Only a clearly small sheet is cut out: when it
// already covers half the photo the frame is kept as it is, so a shadow over
// part of a close-up sheet can never cut writing off. The grey image is
// blurred first so the ruled lines of a form do not split the sheet into
// cells, and the region must stand out from a clearly darker background:
// one box of a ruled page has more paper around it, not a desk. Cutting
// writing off would be silent, so this stays conservative: on a light desk
// the photo is kept whole (checked on 482 real photos, none cut). Colour was
// tried to tell paper from a light desk and failed on lamp-lit sheets.
const SCAN = 400;
const CROP_BELOW = 0.5;   // sheet's box under half the frame: cut it out
const MIN_SHEET = 0.02;   // smaller than this is not a sheet we can find
const MIN_FILL = 0.6;     // share of the box that is bright paper
const MIN_CONTRAST = 45;  // mean grey inside the box minus outside it

export async function findSheet(image: Buffer): Promise<Region | null> {
  const meta = await sharp(image).metadata();
  const { data, info } = await sharp(image).greyscale()
    .resize({ width: SCAN, height: SCAN, fit: 'inside' }).blur(2.5).raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const n = w * h;

  // Otsu: the grey level that best splits paper from background
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < n; i++) hist[data[i]]++;
  let total = 0;
  for (let v = 0; v < 256; v++) total += v * hist[v];
  let below = 0;
  let belowSum = 0;
  let best = 0;
  let threshold = -1;
  for (let v = 0; v < 256; v++) {
    below += hist[v];
    if (!below || below === n) continue;
    belowSum += v * hist[v];
    const m0 = belowSum / below;
    const m1 = (total - belowSum) / (n - below);
    const between = below * (n - below) * (m0 - m1) ** 2;
    if (between > best) { best = between; threshold = v; }
  }
  if (threshold < 0) return null; // one flat colour
  const paper = (i: number) => data[i] > threshold;

  // the largest 4-connected region of paper
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  let top: { area: number; x0: number; y0: number; x1: number; y1: number } | null = null;
  for (let start = 0; start < n; start++) {
    if (seen[start] || !paper(start)) continue;
    let sp = 0;
    stack[sp++] = start;
    seen[start] = 1;
    const r = { area: 0, x0: w, y0: h, x1: 0, y1: 0 };
    while (sp) {
      const i = stack[--sp];
      const x = i % w;
      const y = (i - x) / w;
      r.area++;
      if (x < r.x0) r.x0 = x;
      if (x > r.x1) r.x1 = x;
      if (y < r.y0) r.y0 = y;
      if (y > r.y1) r.y1 = y;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && !seen[j] && paper(j)) { seen[j] = 1; stack[sp++] = j; }
      }
    }
    if (!top || r.area > top.area) top = r;
  }
  if (!top) return null;
  const boxW = top.x1 - top.x0 + 1;
  const boxH = top.y1 - top.y0 + 1;
  if (boxW * boxH >= CROP_BELOW * n) return null;
  if (top.area < MIN_SHEET * n || top.area / (boxW * boxH) < MIN_FILL) return null;
  let inSum = 0;
  let outSum = 0;
  for (let i = 0; i < n; i++) {
    const x = i % w;
    const y = (i - x) / w;
    if (x >= top.x0 && x <= top.x1 && y >= top.y0 && y <= top.y1) inSum += data[i];
    else outSum += data[i];
  }
  if (inSum / (boxW * boxH) - outSum / (n - boxW * boxH) < MIN_CONTRAST) return null;

  // back to the photo's pixels, with a small margin so no edge writing is lost
  const fullW = meta.width ?? w;
  const fullH = meta.height ?? h;
  const scale = fullW / w;
  const mx = boxW * 0.03;
  const my = boxH * 0.03;
  const left = Math.max(0, Math.floor((top.x0 - mx) * scale));
  const topPx = Math.max(0, Math.floor((top.y0 - my) * scale));
  const right = Math.min(fullW, Math.ceil((top.x1 + 1 + mx) * scale));
  const bottom = Math.min(fullH, Math.ceil((top.y1 + 1 + my) * scale));
  return { left, top: topPx, width: right - left, height: bottom - topPx };
}

export async function normalizeImage(rawInput: Buffer, longEdge = LONG_EDGE): Promise<Buffer> {
  const input = await toJpegIfHeic(rawInput);
  let upright: Buffer;
  try {
    // honour EXIF orientation from phone cameras, before looking for the sheet
    upright = await sharp(input, { failOn: 'error' }).rotate().toBuffer();
  } catch {
    throw new ImageError('Fotoğraf açılamadı. JPEG veya PNG olarak yükleyin.');
  }
  const sheet = await findSheet(upright).catch(() => null);
  const cropped = sheet ? sharp(upright).extract(sheet) : sharp(upright);
  return cropped
    .resize({ width: longEdge, height: longEdge, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}
