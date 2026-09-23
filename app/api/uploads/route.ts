import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILES_PER_REQUEST = 8;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_REQUEST_BYTES = 13 * 1024 * 1024;
const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 80;

const attempts = new Map<string, { count: number; resetAt: number }>();

function response(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function clientAddress(request: Request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

function rateLimited(request: Request) {
  const now = Date.now();
  const key = clientAddress(request);
  const current = attempts.get(key);

  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > MAX_REQUESTS_PER_WINDOW;
}

function isJpeg(bytes: Uint8Array) {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isPng(bytes: Uint8Array) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte);
}

function isWebp(bytes: Uint8Array) {
  return (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  );
}

function isHeif(bytes: Uint8Array) {
  if (bytes.length < 12 || String.fromCharCode(...bytes.slice(4, 8)) !== 'ftyp') return false;
  const brand = String.fromCharCode(...bytes.slice(8, 12));
  return ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand);
}

function isSupportedImage(bytes: Uint8Array) {
  return isJpeg(bytes) || isPng(bytes) || isWebp(bytes) || isHeif(bytes);
}

export async function POST(request: Request) {
  if (rateLimited(request)) return response({ error: 'Çok fazla yükleme isteği gönderildi.' }, 429);

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_REQUEST_BYTES) return response({ error: 'Yükleme boyutu sınırı aşıldı.' }, 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return response({ error: 'Dosyalar okunamadı.' }, 400);
  }

  const files = form.getAll('files').filter((entry): entry is File => entry instanceof File);
  if (files.length === 0 || files.length > MAX_FILES_PER_REQUEST) {
    return response({ error: 'Geçersiz dosya sayısı.' }, 400);
  }

  let totalBytes = 0;
  for (const file of files) {
    totalBytes += file.size;
    if (file.size === 0 || file.size > MAX_FILE_BYTES || totalBytes > MAX_REQUEST_BYTES) {
      return response({ error: 'Dosya boyutu sınırı aşıldı.' }, 413);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isSupportedImage(bytes)) return response({ error: 'Desteklenmeyen veya geçersiz görsel.' }, 415);
  }

  // Dosya baytları yalnızca bu istek içinde doğrulanır. Disk, veritabanı veya
  // başka bir kalıcı depoya yazılmadan yanıtla birlikte bellekten bırakılır.
  return response({ accepted: files.length, receipt: randomUUID() });
}
