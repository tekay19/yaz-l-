import { getDb } from '@/db/client';
import { currentUserId, unauthorized } from '@/lib/auth/current';
import { createJob } from '@/lib/jobs/pages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const mode = body.mode === 'klasik' ? 'klasik' : 'optik';
  // Düzeltme.md D1: klasik okuma Task 15'te gelir ve ayrı bir ölçüm kapısından
  // geçer. Bayrak açılana kadar klasik sınav oluşturulamaz — yoksa worker açık
  // uçlu kâğıdı optik okuyucuyla okur ve anlamsız bir puan üretirdi.
  if (mode === 'klasik' && process.env.KLASIK_ENABLED !== 'true') {
    return Response.json({ error: 'Klasik sınav henüz açık değil.' }, { status: 400 });
  }
  const klasikMax = Array.isArray(body.klasikMax)
    ? body.klasikMax.filter((n: unknown) => typeof n === 'number' && n > 0 && n <= 100).slice(0, 50)
    : [];
  if (mode === 'klasik' && klasikMax.length === 0) {
    return Response.json({ error: 'Klasik sınavda her sorunun puanını girin.' }, { status: 400 });
  }
  const title = typeof body.title === 'string' ? body.title : '';
  const job = await createJob(getDb(), userId, { title, mode, klasikMax });
  return Response.json(job, { status: 201 });
}
