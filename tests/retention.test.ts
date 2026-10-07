import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb, makeUser } from './helpers/db';
import { memoryStorage } from './helpers/storage';
import { jobs, pages, payments, users } from '@/db/schema';
import { deleteAccount, runRetention, sentBefore } from '@/lib/retention';
import { deliverPending } from '@/lib/jobs/deliver';
import { refundPages } from '@/lib/credits';
import { fakeMailer } from './helpers/mail';

const days = (n: number) => new Date(Date.now() - n * 86_400_000);

describe('retention', () => {
  it('deletes photos after 7 days and whole jobs after 30', async () => {
    const db = await testDb();
    const st = memoryStorage();
    const u = await makeUser(db);
    const [old] = await db.insert(jobs).values({ userId: u.id, status: 'done', createdAt: days(8) }).returning();
    const [ancient] = await db.insert(jobs).values({ userId: u.id, status: 'done', createdAt: days(31) }).returning();
    await st.write('jobs/o/1.jpg', Buffer.from('x'));
    await db.insert(pages).values({ jobId: old.id, kind: 'student', seq: 1, filePath: 'jobs/o/1.jpg' });
    expect(await runRetention(db, st)).toEqual({ closed: 0, photos: 1, jobs: 1 });
    expect(st.files.size).toBe(0);
    expect(await db.select().from(jobs).where(eq(jobs.id, ancient.id))).toHaveLength(0);
  });

  // Düzeltme.md D5: a job still waiting on the teacher must not lose its
  // photos at the same 7-day mark as a finished one — the review screen
  // needs them. It still gets a hard backstop at 14 days.
  it('keeps photos longer for a job still in review, up to a 14-day backstop', async () => {
    const db = await testDb();
    const st = memoryStorage();
    const u = await makeUser(db);
    const [reviewRecent] = await db.insert(jobs).values({ userId: u.id, status: 'review', createdAt: days(8) }).returning();
    const [reviewStale] = await db.insert(jobs).values({ userId: u.id, status: 'review', createdAt: days(15) }).returning();
    await st.write('jobs/b/1.jpg', Buffer.from('x'));
    await st.write('jobs/c/1.jpg', Buffer.from('x'));
    await db.insert(pages).values([
      { jobId: reviewRecent.id, kind: 'student', seq: 1, filePath: 'jobs/b/1.jpg' },
      { jobId: reviewStale.id, kind: 'student', seq: 1, filePath: 'jobs/c/1.jpg' },
    ]);
    expect(await runRetention(db, st)).toEqual({ closed: 0, photos: 1, jobs: 0 });
    expect(st.files.has('jobs/b/1.jpg')).toBe(true);
    expect(st.files.has('jobs/c/1.jpg')).toBe(false);
  });

  // A sent job's clock starts at submission: a draft prepared a week ahead
  // must not lose its photos while the worker is still reading it.
  it('keeps the photos of a job still being read, counting from submission', async () => {
    const db = await testDb();
    const st = memoryStorage();
    const u = await makeUser(db);
    const [fresh] = await db.insert(jobs).values({ userId: u.id, status: 'queued', createdAt: days(8), submittedAt: days(0) }).returning();
    const [stuck] = await db.insert(jobs).values({ userId: u.id, status: 'processing', createdAt: days(16), submittedAt: days(15) }).returning();
    await st.write('jobs/q/1.jpg', Buffer.from('x'));
    await st.write('jobs/s/1.jpg', Buffer.from('x'));
    await db.insert(pages).values([
      { jobId: fresh.id, kind: 'student', seq: 1, status: 'queued', filePath: 'jobs/q/1.jpg' },
      { jobId: stuck.id, kind: 'student', seq: 1, status: 'queued', filePath: 'jobs/s/1.jpg' },
    ]);
    expect(await runRetention(db, st)).toEqual({ closed: 0, photos: 1, jobs: 0 });
    expect(st.files.has('jobs/q/1.jpg')).toBe(true);
    expect(st.files.has('jobs/s/1.jpg')).toBe(false);
  });

  it('empties a draft nobody sent within a week', async () => {
    const db = await testDb();
    const st = memoryStorage();
    const u = await makeUser(db);
    const [draft] = await db.insert(jobs).values({ userId: u.id, status: 'draft', createdAt: days(8) }).returning();
    await st.write('jobs/d/1.jpg', Buffer.from('x'));
    await db.insert(pages).values({ jobId: draft.id, kind: 'student', seq: 1, filePath: 'jobs/d/1.jpg' });
    expect(await runRetention(db, st)).toEqual({ closed: 0, photos: 1, jobs: 0 });
    expect(await db.select().from(pages).where(eq(pages.jobId, draft.id))).toHaveLength(0);
    expect(st.files.size).toBe(0);
  });

  // Found end to end, not by these tests: PGlite accepts a Date parameter in
  // raw SQL, the production postgres driver throws on it (the worker's hourly
  // retention failed). The cutoff must reach the driver as text.
  it('hands the driver the cutoff as text, never as a Date', async () => {
    const db = await testDb();
    const { params } = db.select({ id: jobs.id }).from(jobs).where(sentBefore(new Date('2026-09-30T12:00:00Z'), 7)).toSQL();
    expect(params).toEqual(['2026-09-23T12:00:00.000Z']);
  });

  it('deletes the account but keeps payment records', async () => {
    const db = await testDb();
    const st = memoryStorage();
    const u = await makeUser(db);
    await db.insert(payments).values({ userId: u.id, pack: 'Başlangıç', pages: 150, amountKurus: 5000, status: 'paid' });
    await deleteAccount(db, st, u.id);
    expect(await db.select().from(users)).toHaveLength(0);
    expect((await db.select().from(payments))[0].userId).toBeNull();
  });

  it('closes a job left unfinished for 30 days, tells the teacher and gives back the rest before deleting it', async () => {
    const db = await testDb();
    const st = memoryStorage();
    const u = await makeUser(db, 'ogretmen@okul.k12.tr', 0);
    const [j] = await db.insert(jobs).values({
      userId: u.id, title: '10-A', mode: 'klasik', status: 'review', reservedPages: 10, createdAt: days(40), submittedAt: days(31),
    }).returning();
    await refundPages(db, u.id, 2, j.id); // two unread pages came back when grading ended
    const first = await runRetention(db, st);
    expect(first).toMatchObject({ closed: 1, jobs: 0 }); // not deleted before the teacher is told
    expect((await db.select().from(jobs).where(eq(jobs.id, j.id)))[0]).toMatchObject({ status: 'failed', failReason: 'review_expired' });
    const mailer = fakeMailer();
    expect(await deliverPending({ db, storage: st, mailer })).toBe(1);
    expect(mailer.sent[0].subject).toContain('kapatıldı');
    expect(mailer.sent[0].text).toContain('Kalan 8 sayfa');
    expect((await db.select().from(users).where(eq(users.id, u.id)))[0].pageBalance).toBe(10);
    expect((await runRetention(db, st)).jobs).toBe(1);
  });
  it('keeps the results of an exam finished lately, even if its draft is old', async () => {
    const db = await testDb();
    const st = memoryStorage();
    const u = await makeUser(db);
    const [late] = await db.insert(jobs).values({
      userId: u.id, status: 'done', createdAt: days(45), submittedAt: days(3), finishedAt: days(2),
    }).returning();
    const [old] = await db.insert(jobs).values({
      userId: u.id, status: 'done', createdAt: days(45), submittedAt: days(40), finishedAt: days(31),
    }).returning();
    expect((await runRetention(db, st)).jobs).toBe(1);
    expect(await db.select().from(jobs).where(eq(jobs.id, late.id))).toHaveLength(1);
    expect(await db.select().from(jobs).where(eq(jobs.id, old.id))).toHaveLength(0);
  });
});
