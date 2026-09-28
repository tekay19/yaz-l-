import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb, makeUser } from '../helpers/db';
import { memoryStorage } from '../helpers/storage';
import { addPage, createJob } from '@/lib/jobs/pages';
import { submitJob } from '@/lib/jobs/submit';
import { claimPages } from '@/lib/queue';
import { processPage } from '@/worker/process';
import { ReadRefused, type Reader } from '@/lib/reader/claude';
import { jobs, pages } from '@/db/schema';

const usage = { inputTokens: 10, outputTokens: 5 };
const okReader: Reader = {
  readKey: async () => ({ read: { questionCount: 1, answers: [{ q: 1, option: 'A' }] }, usage }),
  readStudent: async () => ({ read: { isBackSide: false, studentName: 'Elif', nameConfidence: 'high', unreadable: false, answers: [{ q: 1, marked: ['A'], confidence: 'high' }] }, usage }),
};

async function run(reader: Reader) {
  const db = await testDb();
  const storage = memoryStorage();
  const u = await makeUser(db, 'a@b.co', 10);
  const { id } = await createJob(db, u.id, { title: 't', mode: 'optik' });
  await addPage(db, storage, { jobId: id, kind: 'key', image: Buffer.from('k') });
  await addPage(db, storage, { jobId: id, kind: 'student', image: Buffer.from('s') });
  await submitJob(db, id, u.id, true, true);
  // drain the queue the way the worker loop does
  for (let batch = await claimPages(db, 10); batch.length; batch = await claimPages(db, 10)) {
    for (const p of batch) await processPage({ db, storage, reader }, p);
  }
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  return { db, job };
}

describe('processPage', () => {
  it('reads every page and moves the job to delivering', async () => {
    const { db, job } = await run(okReader);
    expect(job.status).toBe('delivering');
    const rows = await db.select().from(pages);
    expect(rows.every((r) => r.status === 'read' && r.inputTokens === 10)).toBe(true);
  });

  it('fails the job and its waiting students when the key is refused', async () => {
    const { db, job } = await run({ ...okReader, readKey: async () => { throw new ReadRefused('x'); } });
    expect(job.status).toBe('failed');
    const student = (await db.select().from(pages)).find((p) => p.kind === 'student')!;
    expect([student.status, student.error]).toEqual(['failed', 'key_failed']);
  });

  it('marks an unreadable student sheet failed but still delivers', async () => {
    const reader: Reader = { ...okReader, readStudent: async () => ({ read: { isBackSide: false, studentName: null, nameConfidence: 'low', unreadable: true, answers: [] }, usage }) };
    const { db, job } = await run(reader);
    expect(job.status).toBe('delivering');
    const student = (await db.select().from(pages)).find((p) => p.kind === 'student')!;
    expect(student.status).toBe('failed');
    expect(student.error).toBe('unreadable');
  });
});
