import { setKeyText } from '@/lib/klasik/jobs';
import { readJson, withKlasikJob } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// klasik: the answer key typed or pasted instead of (or next to) a photo
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withKlasikJob(id, async (db, job) => {
    const body = await readJson(req);
    if (typeof body.text !== 'string') return Response.json({ error: 'Anahtar metni gönderin.' }, { status: 400 });
    await setKeyText(db, job, body.text);
    return Response.json({ ok: true });
  });
}
