import { paging, withAdmin } from '@/lib/admin/guard';
import { USER_FILTERS, listUsers, type UserFilter } from '@/lib/admin/users';
import { json } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = (req: Request) => withAdmin(req, async (db) => {
  const url = new URL(req.url);
  const { page, size, offset } = paging(url);
  const asked = url.searchParams.get('filtre') as UserFilter;
  const filter = USER_FILTERS.includes(asked) ? asked : 'all';
  const r = await listUsers(db, { q: url.searchParams.get('q') ?? '', filter, offset, size });
  return json({ ...r, page, size });
});
