import { getDb, type Db } from '@/db/client';
import { currentUserId, unauthorized } from '@/lib/auth/current';
import { getOwnedJob } from '@/lib/jobs/pages';
import { KlasikError } from './jobs';

type Job = NonNullable<Awaited<ReturnType<typeof getOwnedJob>>>;

export const noStore = { headers: { 'Cache-Control': 'no-store' } };

// Every klasik route: signed in, the job is the teacher's own and klasik;
// a KlasikError becomes its status and Turkish message.
export async function withKlasikJob(id: string, fn: (db: Db, job: Job) => Promise<Response>): Promise<Response> {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const db = getDb();
  const job = await getOwnedJob(db, id, userId);
  if (!job || job.mode !== 'klasik') return Response.json({ error: 'Sınav bulunamadı.' }, { status: 404 });
  try {
    return await fn(db, job);
  } catch (e) {
    if (e instanceof KlasikError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
