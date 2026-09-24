import { getDb } from '@/db/client';
import { currentUserId, unauthorized } from '@/lib/auth/current';
import { getOwnedJob, removePage } from '@/lib/jobs/pages';
import { getStorage } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; pageId: string }> }) {
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
