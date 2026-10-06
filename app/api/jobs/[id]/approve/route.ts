import { approveJob } from '@/lib/jobs/review';
import { regradesPending } from '@/lib/klasik/jobs';
import { withOwnedJob } from '@/lib/http';

export const runtime = 'nodejs';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withOwnedJob(id, async (db, job) => {
    if (job.mode === 'klasik' && await regradesPending(db, job)) {
      return Response.json({ error: 'Yeniden puanlama sürüyor; birkaç saniye sonra tekrar deneyin.' }, { status: 409 });
    }
    return (await approveJob(db, id))
      ? Response.json({ ok: true }, { status: 202 })
      : Response.json({ error: 'Sınav kontrol aşamasında değil.' }, { status: 409 });
  });
}
