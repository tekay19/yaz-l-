import { getDb } from '@/db/client';
import { currentUserId, unauthorized } from '@/lib/auth/current';
import { getOwnedJob } from '@/lib/jobs/pages';
import { buildReportInput } from '@/lib/report/input';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  const db = getDb();
  const job = await getOwnedJob(db, id, userId);
  if (!job || job.status !== 'review') return Response.json({ error: 'Kontrol bekleyen sınav yok.' }, { status: 404 });
  const input = await buildReportInput(db, id);
  return Response.json({
    roster: job.roster,
    key: input.key,
    keyPageId: input.keyPageId,
    keyFlags: input.keyFlags,
    rows: input.rows.map((r) => ({ ...r, imageUrl: `/api/jobs/${id}/pages/${r.pageId}` })),
    failed: input.failed,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
