import { count, desc, eq } from 'drizzle-orm';
import { getDb, type Db } from '@/db/client';
import { adminActions } from '@/db/schema';
import { currentUser, forbidden, unauthorized, type CurrentUser } from '@/lib/auth/current';
import { fromOwnOrigin } from '@/lib/auth/origin';
import { handled } from '@/lib/http';

// Every /api/admin route: a signed-in user whose role is admin. Anyone else
// gets 401 or 403 and learns nothing about the data. A change (anything but
// GET) must also come from our own pages.
export async function withAdmin(req: Request, fn: (db: Db, admin: CurrentUser) => Promise<Response>): Promise<Response> {
  if (req.method !== 'GET' && !fromOwnOrigin(req, process.env.APP_URL!)) return forbidden();
  const me = await currentUser();
  if (!me) return unauthorized();
  if (me.role !== 'admin') return forbidden();
  return handled(() => fn(getDb(), me));
}

export type Actor = Pick<CurrentUser, 'id' | 'email'>;

export async function logAction(
  db: Db, admin: Actor, action: string, targetType: 'user' | 'job' | 'payment' | 'events', targetId: string,
  detail: Record<string, unknown> = {},
) {
  const [row] = await db.insert(adminActions)
    .values({ adminId: admin.id, adminEmail: admin.email, action, targetType, targetId, detail })
    .returning({ id: adminActions.id });
  return row.id;
}

// ?sayfa=2 style paging, 1-based, capped
export function paging(url: URL, size = 25) {
  const page = Math.min(Math.max(1, Number(url.searchParams.get('sayfa')) || 1), 1000);
  return { page, size, offset: (page - 1) * size };
}

export async function listActions(db: Db, opts: { offset: number; size: number; targetId?: string }) {
  const where = opts.targetId ? eq(adminActions.targetId, opts.targetId) : undefined;
  const [rows, [total]] = await Promise.all([
    db.select().from(adminActions).where(where).orderBy(desc(adminActions.createdAt)).limit(opts.size).offset(opts.offset),
    db.select({ n: count() }).from(adminActions).where(where),
  ]);
  return { rows, total: Number(total.n) };
}
