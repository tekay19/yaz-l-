// Demo panel, step 1: one exam page photo → its transcription. Admin only,
// because every call goes to the paid API. The photo is read in memory and
// never stored.

import { ImageError, checkPhoto, normalizeImage } from '@/lib/images';
import { ReadRefused } from '@/lib/reader/types';
import { createReader, readerModel } from '@/lib/reader';
import { adminRequest } from '@/lib/store';
import { json } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!adminRequest(req)) return json({ error: 'unauthorized' }, 401);
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || file.size === 0) return json({ error: 'Fotoğraf seçin.' }, 400);
  const started = Date.now();
  try {
    const image = await normalizeImage(Buffer.from(await file.arrayBuffer()));
    await checkPhoto(image);
    const { read, usage } = await createReader().readKlasik(image);
    return json({ read, usage, ms: Date.now() - started, model: readerModel() });
  } catch (e) {
    if (e instanceof ImageError) return json({ error: e.message }, 415);
    if (e instanceof ReadRefused) return json({ error: 'Model bu fotoğrafı okumayı reddetti.' }, 502);
    console.error('[demo] read failed', e);
    return json({ error: e instanceof Error ? e.message : 'Okuma başarısız.' }, 502);
  }
}
