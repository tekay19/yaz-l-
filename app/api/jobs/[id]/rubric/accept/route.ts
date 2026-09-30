import { acceptAnswer } from '@/lib/klasik/jobs';
import { withKlasikJob } from '@/lib/klasik/http';

export const runtime = 'nodejs';

// "Bu cevabı kabul et, rubriğe ekle": the question is graded again for the class
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withKlasikJob(id, async (db, job) => {
    const body = await req.json().catch(() => ({}));
    if (typeof body.pageId !== 'string' || !Number.isInteger(body.q)) {
      return Response.json({ error: 'Kâğıt ve soru seçin.' }, { status: 400 });
    }
    await acceptAnswer(db, job, { pageId: body.pageId, q: body.q, note: typeof body.note === 'string' ? body.note : '' });
    return Response.json({ ok: true }, { status: 202 });
  });
}
