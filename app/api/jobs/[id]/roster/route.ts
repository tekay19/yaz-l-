import { getDb } from '@/db/client';
import { currentUserId, unauthorized } from '@/lib/auth/current';
import { getOwnedJob } from '@/lib/jobs/pages';
import { setRoster } from '@/lib/jobs/review';

export const runtime = 'nodejs';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  const db = getDb();
  const job = await getOwnedJob(db, id, userId);
  if (!job) return Response.json({ error: 'Sınav bulunamadı.' }, { status: 404 });
  if (!['draft', 'review'].includes(job.status)) return Response.json({ error: 'Bu aşamada liste değiştirilemez.' }, { status: 409 });
  const body = await req.json().catch(() => ({}));
  const count = await setRoster(db, id, typeof body.roster === 'string' ? body.roster : '');
  return Response.json({ count });
}
