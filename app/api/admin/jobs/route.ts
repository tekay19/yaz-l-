import { paging, withAdmin } from '@/lib/admin/guard';
import { JOB_FILTERS, listJobs, type JobFilter } from '@/lib/admin/jobs';
import { json } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = (req: Request) => withAdmin(req, async (db) => {
  const url = new URL(req.url);
  const { page, size, offset } = paging(url);
  const asked = url.searchParams.get('filtre') as JobFilter;
  const filter = JOB_FILTERS.includes(asked) ? asked : 'all';
  const r = await listJobs(db, {
    q: url.searchParams.get('q') ?? '', filter, mode: url.searchParams.get('mod') ?? '', offset, size,
  });
  return json({ ...r, page, size });
});
