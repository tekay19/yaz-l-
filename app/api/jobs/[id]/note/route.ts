import { setTeacherNote } from '@/lib/klasik/jobs';
import { readJson, withKlasikJob } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// klasik: the teacher's optional note to the reader and grader, set before sending
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withKlasikJob(id, async (db, job) => {
    const body = await readJson(req);
    if (typeof body.note !== 'string') return Response.json({ error: 'Not gönderin.' }, { status: 400 });
    await setTeacherNote(db, job, body.note);
    return Response.json({ ok: true });
  });
}
