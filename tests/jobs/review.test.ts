import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb, makeUser } from '../helpers/db';
import { jobs, pages } from '@/db/schema';
import { maybeCompleteJob } from '@/lib/jobs/progress';
import { OptikPatch, approveJob, saveKeyOverride, savePageOverride, setRoster } from '@/lib/jobs/review';
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

  // A malformed body used to throw inside the save (the route answered 500).
  it('refuses a malformed correction instead of throwing', async () => {
    const { db, job, student } = await processingJob('high');
    expect(await savePageOverride(db, job.id, student.id, { answers: [{ q: 1 } as any] })).toBe(false);
    expect(OptikPatch.safeParse({ answers: [{ q: 1 }] }).success).toBe(false);
    expect(OptikPatch.safeParse({ answers: [{ q: 1, marked: ['Z'] }] }).success).toBe(false);
    expect(OptikPatch.safeParse({ studentName: '   ' }).success).toBe(false);
    expect(OptikPatch.safeParse({ key: [{ q: 2, option: null }] }).success).toBe(true);
  });

  it('merges key corrections question by question', async () => {
    const { db, job } = await processingJob('high');
    const [keyPage] = await db.select().from(pages).where(eq(pages.kind, 'key'));
    expect(await saveKeyOverride(db, job.id, keyPage.id, [{ q: 1, option: 'B' }])).toBe(true);
    expect(await saveKeyOverride(db, job.id, keyPage.id, [{ q: 2, option: null }])).toBe(true);
    const [after] = await db.select().from(pages).where(eq(pages.id, keyPage.id));
    expect(after.override?.key).toEqual([{ q: 1, option: 'B' }, { q: 2, option: null }]);
    // a student page is not a key page
    const [sheet] = await db.select().from(pages).where(eq(pages.kind, 'student'));
    expect(await saveKeyOverride(db, job.id, sheet.id, [{ q: 1, option: 'A' }])).toBe(false);
  });
});
