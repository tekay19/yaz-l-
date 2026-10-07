import { and, eq } from 'drizzle-orm';
import { pages } from '@/db/schema';
import { removePage } from '@/lib/jobs/pages';
import { OptikPatch, saveKeyOverride, savePageOverride } from '@/lib/jobs/review';
import { getStorage } from '@/lib/storage';
import { saveKlasikOverride } from '@/lib/klasik/jobs';
import { withOwnedJob } from '@/lib/http';
import { isUuid } from '@/lib/uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string; pageId: string }> };
const noPage = () => Response.json({ error: 'Sayfa bulunamadı.' }, { status: 404 });

// the page photo, for the review screen; only the owner, only while it exists
export async function GET(_req: Request, { params }: Ctx) {
  const { id, pageId } = await params;
  if (!isUuid(pageId)) return noPage();
  return withOwnedJob(id, async (db) => {
    const [p] = await db.select({ filePath: pages.filePath }).from(pages).where(and(eq(pages.id, pageId), eq(pages.jobId, id)));
    // the row can outlive its file for a moment while retention runs
    const body = p?.filePath ? await getStorage().read(p.filePath).catch(() => null) : null;
    if (!body) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(body), {
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store' },
    });
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id, pageId } = await params;
  if (!isUuid(pageId)) return noPage();
  return withOwnedJob(id, async (db, job) => {
    if (job.status !== 'review') return Response.json({ error: 'Sınav kontrol aşamasında değil.' }, { status: 409 });
    const body = await req.json().catch(() => null);
    if (job.mode === 'klasik') {
      await saveKlasikOverride(db, job, pageId, body);
      return Response.json({ ok: true });
    }
    const parsed = OptikPatch.safeParse(body);
    if (!parsed.success) return Response.json({ error: 'Düzeltme geçersiz.' }, { status: 400 });
    const { key, ...sheet } = parsed.data;
    const ok = key ? await saveKeyOverride(db, id, pageId, key) : await savePageOverride(db, id, pageId, sheet);
    return ok ? Response.json({ ok: true }) : Response.json({ error: 'Düzeltme geçersiz.' }, { status: 400 });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id, pageId } = await params;
  if (!isUuid(pageId)) return noPage();
  return withOwnedJob(id, async (db, job) => {
    if (job.status !== 'draft') return Response.json({ error: 'Gönderilmiş sınav değiştirilemez.' }, { status: 409 });
    const ok = await removePage(db, getStorage(), id, pageId);
    return ok ? new Response(null, { status: 204 }) : noPage();
  });
}
