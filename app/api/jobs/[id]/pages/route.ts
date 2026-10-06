import { asc, eq } from 'drizzle-orm';
import { pages } from '@/db/schema';
import { ImageError, checkPhoto, normalizeImage } from '@/lib/images';
import { JobLockedError, MAX_UPLOAD_BYTES, PageLimitError, addPage } from '@/lib/jobs/pages';
import { MAX_KEY_PAGES, MAX_STUDENT_PAGES } from '@/lib/limits';
import { getStorage } from '@/lib/storage';
import { rateLimited } from '@/lib/store';
import { currentUserId, unauthorized } from '@/lib/auth/current';
import { noStore, withOwnedJob } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const err = (error: string, status: number) => Response.json({ error }, { status });
const TOO_BIG = 'Fotoğraf çok büyük (en fazla 15 MB).';
const LOCKED = 'Gönderilmiş sınava kâğıt eklenemez.';

// What a draft holds so far, for an upload screen opened again (after a
// reload, a sign-in or a payment): the photos in order, the roster, the typed key.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withOwnedJob(id, async (db, job) => {
    const rows = await db.select({ id: pages.id, kind: pages.kind, seq: pages.seq }).from(pages)
      .where(eq(pages.jobId, id)).orderBy(asc(pages.kind), asc(pages.seq));
    return Response.json({
      id: job.id, title: job.title, mode: job.mode, status: job.status,
      roster: job.roster, keyText: job.keyText, teacherNote: job.teacherNote, pages: rows,
    }, noStore);
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // signed out callers are not counted against anyone's upload budget
  if (!(await currentUserId())) return unauthorized();
  if (await rateLimited('upload', req, 300, 600)) return err('Çok fazla yükleme. Biraz bekleyin.', 429);
  const { id } = await params;
  return withOwnedJob(id, async (db, job) => {
    if (job.status !== 'draft') return err(LOCKED, 409);

    if (Number(req.headers.get('content-length') || 0) > MAX_UPLOAD_BYTES) return err(TOO_BIG, 413);
    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    const kind = form?.get('kind') === 'key' ? 'key' : 'student';
    if (!(file instanceof File) || file.size === 0) return err('Fotoğraf seçin.', 400);
    if (file.size > MAX_UPLOAD_BYTES) return err(TOO_BIG, 413);

    // an optik key is a single page that a new photo replaces
    const limit = kind === 'student' ? MAX_STUDENT_PAGES : job.mode === 'klasik' ? MAX_KEY_PAGES : undefined;
    try {
      const image = await normalizeImage(Buffer.from(await file.arrayBuffer()));
      await checkPhoto(image);
      const page = await addPage(db, getStorage(), { jobId: id, kind, image, limit });
      return Response.json(page, { status: 201 });
    } catch (e) {
      if (e instanceof ImageError) return err(e.message, 415);
      if (e instanceof JobLockedError) return err(LOCKED, 409);
      if (e instanceof PageLimitError) {
        return err(kind === 'student' ? `Bir sınavda en fazla ${MAX_STUDENT_PAGES} sayfa olabilir.` : `Cevap anahtarı en fazla ${MAX_KEY_PAGES} sayfa olabilir.`, 400);
      }
      throw e;
    }
  });
}
