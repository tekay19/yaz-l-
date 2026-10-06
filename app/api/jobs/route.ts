import { getDb } from '@/db/client';
import { currentUser, currentUserId, unauthorized, unverified } from '@/lib/auth/current';
import { createJob } from '@/lib/jobs/pages';
import { listJobs } from '@/lib/jobs/status';
import { noStore, readJson } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  return Response.json(await listJobs(getDb(), userId), noStore);
}

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return unauthorized();
  if (!me.verified) return unverified();
  const userId = me.id;
  const body = await readJson(req);
  const mode = body.mode === 'klasik' ? 'klasik' : 'optik';
  // Düzeltme.md D1: klasik okuma Task 15'te gelir ve ayrı bir ölçüm kapısından
  // geçer. Bayrak açılana kadar klasik sınav oluşturulamaz — yoksa worker açık
  // uçlu kâğıdı optik okuyucuyla okur ve anlamsız bir puan üretirdi.
  if (mode === 'klasik' && process.env.KLASIK_ENABLED !== 'true') {
    return Response.json({ error: 'Klasik sınav henüz açık değil.' }, { status: 400 });
  }
  // klasik: the points per question are settled on the rubric screen; given
  // here, they only pre-fill the draft
  const klasikMax = Array.isArray(body.klasikMax)
    ? body.klasikMax.filter((n: unknown) => typeof n === 'number' && n > 0 && n <= 100).slice(0, 50)
    : [];
  const title = typeof body.title === 'string' ? body.title : '';
  const job = await createJob(getDb(), userId, { title, mode, klasikMax });
  return Response.json(job, { status: 201 });
}
