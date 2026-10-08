import { eq } from 'drizzle-orm';
import { jobs } from '@/db/schema';
import { setRoster } from '@/lib/jobs/review';
import { regradeRegrouped } from '@/lib/klasik/jobs';
import { readJson, withOwnedJob } from '@/lib/http';

export const runtime = 'nodejs';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withOwnedJob(id, async (db, job) => {
    if (!['draft', 'review'].includes(job.status)) return Response.json({ error: 'Bu aşamada liste değiştirilemez.' }, { status: 409 });
    const body = await readJson(req);
    const count = await setRoster(db, id, typeof body.roster === 'string' ? body.roster : '');
    // klasik pages are grouped by name: a new list may join or split sheets
    if (job.mode === 'klasik' && job.status === 'review') {
      const [fresh] = await db.select({ roster: jobs.roster }).from(jobs).where(eq(jobs.id, id));
      await regradeRegrouped(db, id, job.roster, fresh.roster);
    }
    return Response.json({ count });
  });
}
