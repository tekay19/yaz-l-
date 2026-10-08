import { and, eq } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { jobs, pages } from '@/db/schema';
import type { Storage } from '@/lib/storage';
import { ReadRefused, type Reader } from '@/lib/reader/types';
import type { KlasikRead } from '@/lib/types';
import { completePage, failPage, type ClaimedPage } from '@/lib/queue';
import { maybeCompleteJob } from '@/lib/jobs/progress';

export type WorkerDeps = { db: Db; storage: Storage; reader: Reader };

async function keyQuestionCount(db: Db, jobId: string): Promise<number> {
  const [key] = await db.select({ result: pages.result }).from(pages)
    .where(and(eq(pages.jobId, jobId), eq(pages.kind, 'key')));
  return key?.result?.type === 'key' ? key.result.read.questionCount : 0;
}

// A student page with no name whose first question is not the exam's first
// continues an earlier page, whatever its printed header suggests: an exam's
// later pages often look like fronts, and taken for one they would start a
// sheet of their own instead of joining the student's.
// "Ad: Elif Yıldız" is a label and a name: kept, the label would give one
// student two names, and two sheets. A label only, with no name after it, stays.
// A number alone ("Öğrenci 17", a school number in the name field) names no
// one: names are matched by their letters, so it would group nothing, while
// counting as a name it kept every page a front of its own. Without it the
// page joins its student by its questions, as an unnamed one does.
const NAME_LABEL = /^\s*(?:ad[ıiIİ]?\s+soyad[ıiIİ]?|ad[ıiIİ]?|[iİ]s[iİ]m|öğrenc[iİ])\s*[:\-–.]?\s+(?=\S)/i;
export function cleanName(read: KlasikRead): KlasikRead {
  if (read.studentName) read.studentName = read.studentName.replace(NAME_LABEL, '');
  if (read.studentName && !/\p{L}/u.test(read.studentName)) read.studentName = null;
  return read;
}

export function markContinuation(read: KlasikRead): KlasikRead {
  const qs = read.answers.map((a) => a.q).filter((q) => q > 0);
  if (!read.studentName?.trim() && qs.length && Math.min(...qs) > 1) read.isBackSide = true;
  return read;
}

export async function processPage({ db, storage, reader }: WorkerDeps, page: ClaimedPage) {
  try {
    if (!page.filePath) throw new ReadRefused('file_missing');
    const image = await storage.read(page.filePath);
    const [job] = await db.select({ mode: jobs.mode, teacherNote: jobs.teacherNote }).from(jobs).where(eq(jobs.id, page.jobId));
    if (job?.mode === 'klasik') {
      // copied down literally, key or student; the rubric and the grades come later.
      // The key also keeps its printed questions and points for the rubric draft.
      const { read, usage } = page.kind === 'key' && reader.readKlasikKey
        ? await reader.readKlasikKey(image, job.teacherNote)
        : await reader.readKlasik(image, job.teacherNote);
      if (page.kind === 'student') markContinuation(cleanName(read));
      const empty = page.kind === 'key' && !read.answers.some((a) => a.lines.length);
      if (read.unreadable || empty) await failPage(db, page, page.kind === 'key' ? 'key_empty' : 'unreadable', false);
      else await completePage(db, page, { type: page.kind === 'key' ? 'klasik-key' : 'klasik-student', read }, usage);
    } else if (page.kind === 'key') {
      const { read, usage } = await reader.readKey(image);
      if (read.questionCount < 1 || read.answers.every((a) => a.option === null)) {
        await failPage(db, page, 'key_empty', false);
      } else {
        await completePage(db, page, { type: 'key', read }, usage);
      }
    } else {
      // claimPages only hands out students once the key is read
      const qc = await keyQuestionCount(db, page.jobId);
      const { read, usage } = await reader.readStudent(image, qc);
      if (read.unreadable) await failPage(db, page, 'unreadable', false);
      else await completePage(db, page, { type: 'student', read }, usage);
    }
  } catch (e) {
    const refused = e instanceof ReadRefused;
    console.error('[worker] page_failed', page.id, e instanceof Error ? e.message : e);
    await failPage(db, page, refused ? 'refused' : e instanceof Error ? e.message : 'error', !refused);
  }
  await maybeCompleteJob(db, page.jobId);
}
