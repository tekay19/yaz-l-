import { getDb } from '@/db/client';
import { currentUserId, unauthorized } from '@/lib/auth/current';
import { getOwnedJob } from '@/lib/jobs/pages';
import { approveJob } from '@/lib/jobs/review';
import { regradesPending } from '@/lib/klasik/jobs';

export const runtime = 'nodejs';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  const db = getDb();
  const job = await getOwnedJob(db, id, userId);
  if (!job) return Response.json({ error: 'Sınav bulunamadı.' }, { status: 404 });
  if (job.mode === 'klasik' && await regradesPending(db, job)) {
    return Response.json({ error: 'Yeniden puanlama sürüyor; birkaç saniye sonra tekrar deneyin.' }, { status: 409 });
  }
  return (await approveJob(db, id))
    ? Response.json({ ok: true }, { status: 202 })
    : Response.json({ error: 'Sınav kontrol aşamasında değil.' }, { status: 409 });
}
