import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { pages } from '@/db/schema';
import { currentUserId, unauthorized } from '@/lib/auth/current';
import { getOwnedJob, removePage } from '@/lib/jobs/pages';
import { OptikPatch, saveKeyOverride, savePageOverride } from '@/lib/jobs/review';
import { getStorage } from '@/lib/storage';
import { KlasikError, saveKlasikOverride } from '@/lib/klasik/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string; pageId: string }> };

// the page photo, for the review screen; only the owner, only while it exists
export async function GET(_req: Request, { params }: Ctx) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { id, pageId } = await params;
  const db = getDb();
  if (!(await getOwnedJob(db, id, userId))) return new Response(null, { status: 404 });
  const [p] = await db.select({ filePath: pages.filePath }).from(pages).where(and(eq(pages.id, pageId), eq(pages.jobId, id)));
  if (!p?.filePath) return new Response(null, { status: 404 });
  const body = await getStorage().read(p.filePath);
  return new Response(new Uint8Array(body), {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store' },
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { id, pageId } = await params;
  const db = getDb();
  const job = await getOwnedJob(db, id, userId);
  if (!job || job.status !== 'review') return Response.json({ error: 'Sınav kontrol aşamasında değil.' }, { status: 409 });
  const body = await req.json().catch(() => null);
  if (job.mode === 'klasik') {
    try {
      await saveKlasikOverride(db, job, pageId, body);
      return Response.json({ ok: true });
    } catch (e) {
      if (e instanceof KlasikError) return Response.json({ error: e.message }, { status: e.status });
      throw e;
    }
  }
  const parsed = OptikPatch.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Düzeltme geçersiz.' }, { status: 400 });
  const { key, ...sheet } = parsed.data;
  const ok = key ? await saveKeyOverride(db, id, pageId, key) : await savePageOverride(db, id, pageId, sheet);
  return ok ? Response.json({ ok: true }) : Response.json({ error: 'Düzeltme geçersiz.' }, { status: 400 });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const { id, pageId } = await params;
  const db = getDb();
  const job = await getOwnedJob(db, id, userId);
  if (!job) return Response.json({ error: 'Sınav bulunamadı.' }, { status: 404 });
  if (job.status !== 'draft') return Response.json({ error: 'Gönderilmiş sınav değiştirilemez.' }, { status: 409 });
  const ok = await removePage(db, getStorage(), id, pageId);
  return ok ? new Response(null, { status: 204 }) : Response.json({ error: 'Sayfa bulunamadı.' }, { status: 404 });
}
