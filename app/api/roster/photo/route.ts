import { currentUser, unauthorized } from '@/lib/auth/current';
import { ImageError } from '@/lib/images';
import { MAX_UPLOAD_BYTES } from '@/lib/jobs/pages';
import { createReader } from '@/lib/reader';
import { readRosterPhoto } from '@/lib/roster';
import { rateLimited } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const err = (error: string, status: number) => Response.json({ error }, { status });

// A photo of the class list → the names on it. Nothing is saved: the names
// go into the roster field for the teacher to check first.
export async function POST(req: Request) {
  if (!(await currentUser())) return unauthorized();
  if (await rateLimited('roster-photo', req, 30, 3600)) return err('Çok fazla deneme. Biraz sonra tekrar deneyin.', 429);
  if (Number(req.headers.get('content-length') || 0) > MAX_UPLOAD_BYTES) return err('Fotoğraf çok büyük (en fazla 15 MB).', 413);
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || file.size === 0) return err('Fotoğraf seçin.', 400);
  if (file.size > MAX_UPLOAD_BYTES) return err('Fotoğraf çok büyük (en fazla 15 MB).', 413);
  try {
    const names = await readRosterPhoto(createReader(), Buffer.from(await file.arrayBuffer()));
    if (!names.length) return err('Fotoğrafta öğrenci adı bulunamadı. Listeyi daha yakından ve net çekip tekrar deneyin.', 422);
    return Response.json({ names });
  } catch (e) {
    if (e instanceof ImageError) return err(e.message, 415);
    console.error('[roster] photo_failed', e instanceof Error ? e.message : e);
    return err('Liste okunamadı. Biraz sonra tekrar deneyin.', 502);
  }
}
