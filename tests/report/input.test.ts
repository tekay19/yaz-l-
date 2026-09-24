import { describe, expect, it } from 'vitest';
import { testDb, makeUser } from '../helpers/db';
import { jobs, pages } from '@/db/schema';
import { buildReportInput } from '@/lib/report/input';

describe('buildReportInput', () => {
  it('scores read sheets, lists failed ones and flags unknown names', async () => {
    const db = await testDb();
    const u = await makeUser(db);
    const [job] = await db.insert(jobs).values({ userId: u.id, title: '9-B Mat', status: 'delivering' }).returning();
    await db.insert(pages).values([
      { jobId: job.id, kind: 'key', seq: 1, status: 'read', result: { type: 'key', read: { questionCount: 2, answers: [{ q: 1, option: 'A' }, { q: 2, option: 'B' }] } } },
      { jobId: job.id, kind: 'student', seq: 1, status: 'read', result: { type: 'student', read: { isBackSide: false, studentName: 'Elif', nameConfidence: 'high', unreadable: false, answers: [{ q: 1, marked: ['A'], confidence: 'high' }, { q: 2, marked: ['B'], confidence: 'high' }] } } },
      { jobId: job.id, kind: 'student', seq: 2, status: 'read', result: { type: 'student', read: { isBackSide: false, studentName: null, nameConfidence: 'low', unreadable: false, answers: [{ q: 1, marked: ['C'], confidence: 'high' }] } } },
      { jobId: job.id, kind: 'student', seq: 3, status: 'failed', error: 'unreadable' },
    ]);
    const r = await buildReportInput(db, job.id);
    expect(r.rows.map((x) => [x.student, x.score])).toEqual([['Elif', 100], ['Kâğıt 2', 0]]);
    expect(r.rows[1].flags).toContain('İsim okunamadı');
    expect(r.failed).toEqual([{ seq: 3, reason: 'Fotoğraf okunamadı' }]);
    expect(r.needsReview).toBe(true);
  });
});
