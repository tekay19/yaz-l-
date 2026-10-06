import { buildReportInput } from '@/lib/report/input';
import { klasikReviewView } from '@/lib/klasik/jobs';
import { noStore, withOwnedJob } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withOwnedJob(id, async (db, job) => {
    if (job.status !== 'review') return Response.json({ error: 'Kontrol bekleyen sınav yok.' }, { status: 409 });
    if (job.mode === 'klasik') return Response.json(await klasikReviewView(db, job), noStore);
    const input = await buildReportInput(db, id);
    return Response.json({
      roster: job.roster,
      key: input.key,
      keyPageId: input.keyPageId,
      keyFlags: input.keyFlags,
      rows: input.rows.map((r) => ({ ...r, imageUrl: `/api/jobs/${id}/pages/${r.pageId}` })),
      failed: input.failed,
    }, noStore);
  });
}
