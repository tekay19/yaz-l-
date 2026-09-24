import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb, makeUser } from './helpers/db';
import { memoryStorage } from './helpers/storage';
import { jobs, pages, payments, users } from '@/db/schema';
import { deleteAccount, runRetention } from '@/lib/retention';

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
    expect(await runRetention(db, st)).toEqual({ photos: 1, jobs: 1 });
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
    expect(await runRetention(db, st)).toEqual({ photos: 1, jobs: 0 });
    expect(st.files.has('jobs/b/1.jpg')).toBe(true);
    expect(st.files.has('jobs/c/1.jpg')).toBe(false);
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
});
