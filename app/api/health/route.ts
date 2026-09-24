import { getDb } from '@/db/client';
import { healthy } from '@/lib/health';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return (await healthy(getDb, process.env.UPLOAD_DIR || '/data/uploads'))
    ? Response.json({ ok: true })
    : Response.json({ ok: false }, { status: 503 });
}
