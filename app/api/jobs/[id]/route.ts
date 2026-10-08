import { jobStatus } from '@/lib/jobs/status';
import { noStore, withOwnedJob } from '@/lib/http';
import { deleteJob } from '@/lib/retention';
import { getStorage } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withOwnedJob(id, async (db) => Response.json(await jobStatus(db, id), noStore));
}

// the teacher removes an exam from the list, its photos and results with it
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withOwnedJob(id, async (db) => ((await deleteJob(db, getStorage(), id))
    ? new Response(null, { status: 204 })
    : Response.json({ error: 'Okunan ya da puanlanan bir sınav silinemez; bitince silebilirsiniz.' }, { status: 409 })));
}
