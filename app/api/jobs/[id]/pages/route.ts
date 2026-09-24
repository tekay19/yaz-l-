import { and, count, eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { pages } from '@/db/schema';
import { currentUserId, unauthorized } from '@/lib/auth/current';
import { ImageError, normalizeImage } from '@/lib/images';
import { JobLockedError, MAX_STUDENT_PAGES, MAX_UPLOAD_BYTES, addPage, getOwnedJob } from '@/lib/jobs/pages';
import { getStorage } from '@/lib/storage';
import { rateLimited } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const err = (error: string, status: number) => Response.json({ error }, { status });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  if (await rateLimited('upload', req, 300, 600)) return err('Çok fazla yükleme. Biraz bekleyin.', 429);
  const { id } = await params;
  const db = getDb();
  const job = await getOwnedJob(db, id, userId);
  if (!job) return err('Sınav bulunamadı.', 404);
  if (job.status !== 'draft') return err('Gönderilmiş sınava kâğıt eklenemez.', 409);

  if (Number(req.headers.get('content-length') || 0) > MAX_UPLOAD_BYTES) return err('Fotoğraf çok büyük (en fazla 15 MB).', 413);
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const kind = form?.get('kind') === 'key' ? 'key' : 'student';
  if (!(file instanceof File) || file.size === 0) return err('Fotoğraf seçin.', 400);
  if (file.size > MAX_UPLOAD_BYTES) return err('Fotoğraf çok büyük (en fazla 15 MB).', 413);

  if (kind === 'student') {
    const [{ n }] = await db.select({ n: count() }).from(pages)
      .where(and(eq(pages.jobId, id), eq(pages.kind, 'student')));
    if (n >= MAX_STUDENT_PAGES) return err(`Bir sınavda en fazla ${MAX_STUDENT_PAGES} sayfa olabilir.`, 400);
  }

  try {
    const image = await normalizeImage(Buffer.from(await file.arrayBuffer()));
    const page = await addPage(db, getStorage(), { jobId: id, kind, image });
    return Response.json(page, { status: 201 });
  } catch (e) {
    if (e instanceof ImageError) return err(e.message, 415);
    if (e instanceof JobLockedError) return err('Gönderilmiş sınava kâğıt eklenemez.', 409);
    throw e;
  }
}
