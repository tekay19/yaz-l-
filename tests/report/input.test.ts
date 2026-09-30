import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
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

  // The reader left q2 out (row cut off in the photo); the teacher enters it
  // on the review screen. Before the fix the entry was stored but ignored.
  it('applies the answer the teacher entered for a question the reader missed', async () => {
    const db = await testDb();
    const u = await makeUser(db);
    const [job] = await db.insert(jobs).values({ userId: u.id, status: 'review', roster: ['Elif Yılmaz'] }).returning();
    await db.insert(pages).values([
      { jobId: job.id, kind: 'key', seq: 1, status: 'read', result: key3('B') },
      { jobId: job.id, kind: 'student', seq: 1, status: 'read', override: { answers: [{ q: 2, marked: ['B'] }] },
        result: student('Elif Yılmaz', [{ q: 1, marked: ['A'] }, { q: 3, marked: ['C'] }]) },
    ]);
    const r = await buildReportInput(db, job.id);
    expect(r.rows[0]).toMatchObject({ correct: 3, score: 100, flags: [] });
  });

  // A key answer read as blank silently removed that question for the whole
  // class. Now it holds the job for the teacher, who sets it or confirms it.
  it('holds a key with a blank answer until the teacher settles it', async () => {
    const db = await testDb();
    const u = await makeUser(db);
    const [job] = await db.insert(jobs).values({ userId: u.id, status: 'review', roster: ['Elif Yılmaz'] }).returning();
    const [keyPage] = await db.insert(pages).values([
      { jobId: job.id, kind: 'key', seq: 1, status: 'read', result: key3(null) },
      { jobId: job.id, kind: 'student', seq: 1, status: 'read',
        result: student('Elif Yılmaz', [{ q: 1, marked: ['A'] }, { q: 2, marked: ['A'] }, { q: 3, marked: ['C'] }]) },
    ]).returning();
    let r = await buildReportInput(db, job.id);
    expect(r.keyFlags).toEqual(['Anahtarda okunamayan soru: 2']);
    expect(r.needsReview).toBe(true);
    expect(r.keyPageId).toBe(keyPage.id);

    await db.update(pages).set({ override: { key: [{ q: 2, option: 'B' }] } }).where(eq(pages.id, keyPage.id));
    r = await buildReportInput(db, job.id);
    expect(r.keyFlags).toEqual([]);
    expect(r.rows[0]).toMatchObject({ correct: 2, wrong: 1, score: 67 });

    // "this question has no key": no flag, and it counts for nobody
    await db.update(pages).set({ override: { key: [{ q: 2, option: null }] } }).where(eq(pages.id, keyPage.id));
    r = await buildReportInput(db, job.id);
    expect(r.keyFlags).toEqual([]);
    expect(r.rows[0]).toMatchObject({ correct: 2, score: 100 });
  });

  it('flags two sheets that ended up under the same name', async () => {
    const db = await testDb();
    const u = await makeUser(db);
    const [job] = await db.insert(jobs).values({ userId: u.id, status: 'review', roster: ['Ali Yılmaz', 'Ali Yıldız'] }).returning();
    const all = [{ q: 1, marked: ['A' as const] }, { q: 2, marked: ['B' as const] }, { q: 3, marked: ['C' as const] }];
    await db.insert(pages).values([
      { jobId: job.id, kind: 'key', seq: 1, status: 'read', result: key3('B') },
      { jobId: job.id, kind: 'student', seq: 1, status: 'read', result: student('Ali Yılmaz', all) },
      { jobId: job.id, kind: 'student', seq: 2, status: 'read', result: student('Ali Yilmaz', all) },
    ]);
    const r = await buildReportInput(db, job.id);
    expect(r.rows.map((x) => x.flags)).toEqual([['İsim başka bir kâğıtta da var'], ['İsim başka bir kâğıtta da var']]);
    expect(r.needsReview).toBe(true);
  });
});

function key3(q2: 'B' | null) {
  return { type: 'key' as const, read: { questionCount: 3, answers: [{ q: 1, option: 'A' as const }, { q: 2, option: q2 }, { q: 3, option: 'C' as const }] } };
}
function student(name: string, answers: { q: number; marked: ('A' | 'B' | 'C')[] }[]) {
  return { type: 'student' as const, read: { isBackSide: false, studentName: name, nameConfidence: 'high' as const, unreadable: false,
    answers: answers.map((a) => ({ ...a, confidence: 'high' as const })) } };
}
