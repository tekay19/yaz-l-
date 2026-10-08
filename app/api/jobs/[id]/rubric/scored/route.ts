import { followTeacher } from '@/lib/klasik/jobs';
import { readJson, withKlasikJob } from '@/lib/http';

export const runtime = 'nodejs';

// "Diğerlerini de böyle puanla": the teacher's own points for a question become
// its examples, and the question is graded again on the sheets they did not score
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withKlasikJob(id, async (db, job) => {
    const body = await readJson(req);
    if (!Number.isInteger(body.q)) return Response.json({ error: 'Soru seçin.' }, { status: 400 });
    return Response.json(await followTeacher(db, job, body.q), { status: 202 });
  });
}
