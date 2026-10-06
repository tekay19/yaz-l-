// Demo panel, step 2: one student's page transcriptions → points per
// criterion, scored by the product's own code against the demo rubric.

import { z } from 'zod';
import { KlasikReadSchema } from '@/lib/reader/schemas';
import { createReader } from '@/lib/reader';
import { adminRequest } from '@/lib/store';
import { json, readJson } from '@/lib/http';
import { DEMO_RUBRIC } from '@/lib/demo/exam';
import { gradeDemoSheets } from '@/lib/demo/grade';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const Body = z.object({ pages: z.array(KlasikReadSchema).min(1).max(6) });

export async function GET(req: Request) {
  if (!adminRequest(req)) return json({ error: 'unauthorized' }, 401);
  return json({ rubric: DEMO_RUBRIC });
}

export async function POST(req: Request) {
  if (!adminRequest(req)) return json({ error: 'unauthorized' }, 401);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: 'Okuma verisi geçersiz.' }, 400);
  try {
    const sheets = await gradeDemoSheets(createReader(), DEMO_RUBRIC, parsed.data.pages);
    return json({ sheets });
  } catch (e) {
    console.error('[demo] grade failed', e);
    return json({ error: e instanceof Error ? e.message : 'Puanlama başarısız.' }, 502);
  }
}
