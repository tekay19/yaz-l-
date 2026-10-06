import { listActions, paging, withAdmin } from '@/lib/admin/guard';
import { json } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = (req: Request) => withAdmin(req, async (db) => {
  const { page, size, offset } = paging(new URL(req.url), 50);
  return json({ ...(await listActions(db, { offset, size })), page, size });
});
