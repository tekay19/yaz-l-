// One labelled sheet per request for the measurement screen (/panel/olcum).
// Each call sends the photo to the paid API, so it is admin only. The photo is
// read in memory and never stored; the screen compares the reading with the
// admin's own labels using lib/eval/metrics.

import { ImageError, checkPhoto, normalizeImage } from '@/lib/images';
import { ReadRefused, type Effort } from '@/lib/reader/claude';
import { createReader, readerModel } from '@/lib/reader';
import { adminRequest } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EFFORTS = new Set<Effort>(['low', 'medium', 'high']);
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  if (!adminRequest(req)) return json({ error: 'unauthorized' }, 401);

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const kind = form?.get('kind') === 'key' ? 'key' : 'student';
  const questionCount = Number(form?.get('questionCount'));
  const effort = String(form?.get('effort') ?? 'medium') as Effort;
  if (!(file instanceof File) || file.size === 0) return json({ error: 'Fotoğraf seçin.' }, 400);
  if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 200) {
    return json({ error: 'Soru sayısı 1 ile 200 arasında olmalı.' }, 400);
  }
  if (!EFFORTS.has(effort)) return json({ error: 'Geçersiz efor.' }, 400);

  const started = Date.now();
  try {
    const image = await normalizeImage(Buffer.from(await file.arrayBuffer()));
    // measure what the product would accept, not photos it refuses at upload
    await checkPhoto(image);
    const reader = createReader({ effort });
    const out = kind === 'key' ? await reader.readKey(image) : await reader.readStudent(image, questionCount);
    return json({ read: out.read, usage: out.usage, ms: Date.now() - started, model: readerModel(), effort });
  } catch (e) {
    if (e instanceof ImageError) return json({ error: e.message }, 415);
    if (e instanceof ReadRefused) return json({ error: 'Model bu fotoğrafı okumayı reddetti.' }, 502);
    return json({ error: e instanceof Error ? e.message : 'Okuma başarısız.' }, 502);
  }
}
