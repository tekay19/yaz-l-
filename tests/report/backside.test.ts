import { describe, expect, it } from 'vitest';
import { testDb, makeUser } from '../helpers/db';
import { jobs, pages } from '@/db/schema';
import { buildReportInput } from '@/lib/report/input';

describe('back sides', () => {
  it('merges a back-side photo into the previous sheet', async () => {
    const db = await testDb();
    const u = await makeUser(db);
    const [job] = await db.insert(jobs).values({ userId: u.id, status: 'delivering' }).returning();
    const key = { type: 'key' as const, read: { questionCount: 2, answers: [{ q: 1, option: 'A' as const }, { q: 2, option: 'B' as const }] } };
    await db.insert(pages).values([
      { jobId: job.id, kind: 'key', seq: 1, status: 'read', result: key },
      { jobId: job.id, kind: 'student', seq: 1, status: 'read', result: { type: 'student', read: { isBackSide: false, studentName: 'Elif', nameConfidence: 'high', unreadable: false, answers: [{ q: 1, marked: ['A'], confidence: 'high' }] } } },
      { jobId: job.id, kind: 'student', seq: 2, status: 'read', result: { type: 'student', read: { isBackSide: true, studentName: null, nameConfidence: 'low', unreadable: false, answers: [{ q: 2, marked: ['B'], confidence: 'high' }] } } },
    ]);
    const r = await buildReportInput(db, job.id);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ student: 'Elif', correct: 2, score: 100 });
  });
});
