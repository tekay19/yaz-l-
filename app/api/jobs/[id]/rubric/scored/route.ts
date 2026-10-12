import { followTeacher } from '@/lib/klasik/jobs';
import { readJson, withKlasikJob } from '@/lib/http';

export const runtime = 'nodejs';

// "Diğerlerini de böyle puanla": the teacher's own points for a question become
// its examples, and the question is graded again on the sheets they did not
// score; `all` does it for every question once the first sheets are checked,
// `qs` for the questions whose best answers were judged after that
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withKlasikJob(id, async (db, job) => {
    const body = await readJson(req);
    if (body.all === true) return Response.json(await followTeacher(db, job, 'all'), { status: 202 });
    if (Array.isArray(body.qs)) {
      if (body.qs.length > 50 || !body.qs.every((q: unknown) => Number.isInteger(q))) return Response.json({ error: 'Soru seçin.' }, { status: 400 });
      return Response.json(await followTeacher(db, job, body.qs), { status: 202 });
    }
    if (!Number.isInteger(body.q)) return Response.json({ error: 'Soru seçin.' }, { status: 400 });
    return Response.json(await followTeacher(db, job, body.q), { status: 202 });
  });
}
