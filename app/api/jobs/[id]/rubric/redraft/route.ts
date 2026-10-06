import { redraftRubric } from '@/lib/klasik/jobs';
import { withKlasikJob } from '@/lib/http';

export const runtime = 'nodejs';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withKlasikJob(id, async (db, job) => {
    await redraftRubric(db, job);
    return Response.json({ ok: true }, { status: 202 });
  });
}
