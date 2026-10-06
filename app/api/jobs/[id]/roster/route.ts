import { setRoster } from '@/lib/jobs/review';
import { readJson, withOwnedJob } from '@/lib/http';

export const runtime = 'nodejs';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withOwnedJob(id, async (db, job) => {
    if (!['draft', 'review'].includes(job.status)) return Response.json({ error: 'Bu aşamada liste değiştirilemez.' }, { status: 409 });
    const body = await readJson(req);
    const count = await setRoster(db, id, typeof body.roster === 'string' ? body.roster : '');
    return Response.json({ count });
  });
}
