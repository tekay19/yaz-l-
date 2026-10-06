import { visitorStats } from '@/lib/admin/analytics';
import { logAction, withAdmin } from '@/lib/admin/guard';
import { json } from '@/lib/http';
import { clearEvents, readEvents } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = (req: Request) => withAdmin(req, async (db) => {
  const range = new URL(req.url).searchParams.get('range') || '7d';
  return json(visitorStats(await readEvents(undefined, db), range));
});

export const DELETE = (req: Request) => withAdmin(req, async (db, admin) => {
  await clearEvents(db);
  await logAction(db, admin, 'events.clear', 'events', '*');
  return json({ ok: true });
});
