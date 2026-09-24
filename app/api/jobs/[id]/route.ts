import { getDb } from '@/db/client';
import { currentUserId, unauthorized } from '@/lib/auth/current';
import { getOwnedJob } from '@/lib/jobs/pages';
import { jobStatus } from '@/lib/jobs/status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  const db = getDb();
  if (!(await getOwnedJob(db, id, userId))) return Response.json({ error: 'Sınav bulunamadı.' }, { status: 404 });
  return Response.json(await jobStatus(db, id), { headers: { 'Cache-Control': 'no-store' } });
}
