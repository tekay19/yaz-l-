import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb, makeUser } from '../helpers/db';
import { jobs, pages } from '@/db/schema';
import { maybeCompleteJob } from '@/lib/jobs/progress';
import { approveJob, savePageOverride, setRoster } from '@/lib/jobs/review';
import { buildReportInput } from '@/lib/report/input';

async function processingJob(nameConfidence: 'high' | 'low') {
  const db = await testDb();
  const u = await makeUser(db);
  const [job] = await db.insert(jobs).values({ userId: u.id, status: 'processing' }).returning();
  const [, student] = await db.insert(pages).values([
    { jobId: job.id, kind: 'key', seq: 1, status: 'read', result: { type: 'key', read: { questionCount: 1, answers: [{ q: 1, option: 'A' }] } } },
    { jobId: job.id, kind: 'student', seq: 1, status: 'read', result: { type: 'student', read: { isBackSide: false, studentName: 'Elf Yılmz', nameConfidence, unreadable: false, answers: [{ q: 1, marked: ['A'], confidence: 'low' }] } } },
  ]).returning();
  return { db, job, student };
}

describe('review', () => {
  it('holds a job with flags in review until the teacher approves', async () => {
    const { db, job, student } = await processingJob('low');
    expect(await maybeCompleteJob(db, job.id)).toBe('review');
    expect(await savePageOverride(db, job.id, student.id, { studentName: 'Elif Yılmaz', answers: [{ q: 1, marked: ['A'] }] })).toBe(true);
    const r = await buildReportInput(db, job.id);
    expect(r.rows[0]).toMatchObject({ student: 'Elif Yılmaz', flags: [] });
    expect(await approveJob(db, job.id)).toBe(true);
    expect((await db.select().from(jobs).where(eq(jobs.id, job.id)))[0].status).toBe('delivering');
  });

  it('parses a pasted roster, one name per line', async () => {
    const { db, job } = await processingJob('high');
    expect(await setRoster(db, job.id, 'Elif Yılmaz\n\n  Mert Kaya \n')).toBe(2);
  });

  it('rejects answer overrides with invalid options', async () => {
    const { db, job, student } = await processingJob('high');
    expect(await savePageOverride(db, job.id, student.id, { answers: [{ q: 1, marked: ['Z' as any] }] })).toBe(false);
  });
});
