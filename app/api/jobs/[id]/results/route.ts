import { examResults } from '@/lib/jobs/results';
import { noStore, withOwnedJob } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withOwnedJob(id, async (db, job) => Response.json(await examResults(db, job), noStore));
}
