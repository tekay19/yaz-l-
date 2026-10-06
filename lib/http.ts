import { getDb, type Db } from '@/db/client';
import { currentUserId, unauthorized } from '@/lib/auth/current';
import { getOwnedJob } from '@/lib/jobs/pages';

type Job = NonNullable<Awaited<ReturnType<typeof getOwnedJob>>>;

export const noStore = { headers: { 'Cache-Control': 'no-store' } };

export const json = (body: unknown, status = 200) => Response.json(body, { status, ...noStore });

// A thrown HttpError becomes its status and (Turkish) message.
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// The request body as a plain object. A body that is not JSON, or is JSON
// but not an object (`null`, `[]`, `"x"`), reads as {} so a handler can look
// at fields without crashing on `null.x`.
export async function readJson(req: Request): Promise<Record<string, any>> {
  const body: unknown = await req.json().catch(() => null);
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, any>) : {};
}

const notFound = () => Response.json({ error: 'Sınav bulunamadı.' }, { status: 404 });

// Every job route: signed in, and the job is the teacher's own (and of the
// given mode, when one is asked for).
export async function withOwnedJob(
  id: string,
  fn: (db: Db, job: Job, userId: string) => Promise<Response>,
  opts: { mode?: 'optik' | 'klasik' } = {},
): Promise<Response> {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const db = getDb();
  const job = await getOwnedJob(db, id, userId);
  if (!job || (opts.mode && job.mode !== opts.mode)) return notFound();
  try {
    return await fn(db, job, userId);
  } catch (e) {
    if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export const withKlasikJob = (id: string, fn: (db: Db, job: Job) => Promise<Response>) =>
  withOwnedJob(id, fn, { mode: 'klasik' });
