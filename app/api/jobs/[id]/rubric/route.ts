import { rubricView, saveRubric } from '@/lib/klasik/jobs';
import { noStore, withKlasikJob } from '@/lib/klasik/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return withKlasikJob(id, async (_db, job) => Response.json(rubricView(job), noStore));
}

// the teacher's edits, while the rubric waits for approval
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  return withKlasikJob(id, async (db, job) => {
    const rubric = await saveRubric(db, job, await req.json().catch(() => null));
    return Response.json({ rubric });
  });
}
