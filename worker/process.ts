import { and, eq } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { pages } from '@/db/schema';
import type { Storage } from '@/lib/storage';
import { ReadRefused, type Reader } from '@/lib/reader/claude';
import { completePage, failPage, type ClaimedPage } from '@/lib/queue';
import { maybeCompleteJob } from '@/lib/jobs/progress';

export type WorkerDeps = { db: Db; storage: Storage; reader: Reader };

async function keyQuestionCount(db: Db, jobId: string): Promise<number> {
  const [key] = await db.select({ result: pages.result }).from(pages)
    .where(and(eq(pages.jobId, jobId), eq(pages.kind, 'key')));
  return key?.result?.type === 'key' ? key.result.read.questionCount : 0;
}

export async function processPage({ db, storage, reader }: WorkerDeps, page: ClaimedPage) {
  try {
    if (!page.filePath) throw new ReadRefused('file_missing');
    const image = await storage.read(page.filePath);
    if (page.kind === 'key') {
      const { read, usage } = await reader.readKey(image);
      if (read.questionCount < 1 || read.answers.every((a) => a.option === null)) {
        await failPage(db, page.id, 'key_empty', false);
      } else {
        await completePage(db, page.id, { type: 'key', read }, usage);
      }
    } else {
      // claimPages only hands out students once the key is read
      const qc = await keyQuestionCount(db, page.jobId);
      const { read, usage } = await reader.readStudent(image, qc);
      if (read.unreadable) await failPage(db, page.id, 'unreadable', false);
      else await completePage(db, page.id, { type: 'student', read }, usage);
    }
  } catch (e) {
    const refused = e instanceof ReadRefused;
    console.error('[worker] page_failed', page.id, e instanceof Error ? e.message : e);
    await failPage(db, page.id, refused ? 'refused' : e instanceof Error ? e.message : 'error', !refused);
  }
  await maybeCompleteJob(db, page.jobId);
}
