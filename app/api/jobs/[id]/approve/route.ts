import { getDb } from '@/db/client';
import { currentUserId, unauthorized } from '@/lib/auth/current';
import { getOwnedJob } from '@/lib/jobs/pages';
import { approveJob } from '@/lib/jobs/review';

export const runtime = 'nodejs';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  const db = getDb();
  if (!(await getOwnedJob(db, id, userId))) return Response.json({ error: 'Sınav bulunamadı.' }, { status: 404 });
  return (await approveJob(db, id))
    ? Response.json({ ok: true }, { status: 202 })
    : Response.json({ error: 'Sınav kontrol aşamasında değil.' }, { status: 409 });
}
