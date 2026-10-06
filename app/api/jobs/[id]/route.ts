import { jobStatus } from '@/lib/jobs/status';
import { noStore, withOwnedJob } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withOwnedJob(id, async (db) => Response.json(await jobStatus(db, id), noStore));
}
