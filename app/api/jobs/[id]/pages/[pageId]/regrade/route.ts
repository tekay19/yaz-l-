import { requestRegrade } from '@/lib/klasik/jobs';
import { withKlasikJob } from '@/lib/http';

export const runtime = 'nodejs';

// after grading gave up on a sheet
export async function POST(_req: Request, { params }: { params: Promise<{ id: string; pageId: string }> }) {
  const { id, pageId } = await params;
  return withKlasikJob(id, async (db, job) => {
    await requestRegrade(db, job, pageId);
    return Response.json({ ok: true }, { status: 202 });
  });
}
