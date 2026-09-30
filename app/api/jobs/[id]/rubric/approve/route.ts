import { approveRubric } from '@/lib/klasik/jobs';
import { withKlasikJob } from '@/lib/klasik/http';

export const runtime = 'nodejs';

// from here on the sheets are graded against this rubric
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withKlasikJob(id, async (db, job) => {
    await approveRubric(db, job);
    return Response.json({ ok: true }, { status: 202 });
  });
}
