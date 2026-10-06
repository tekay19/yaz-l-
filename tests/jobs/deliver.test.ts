import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { testDb, makeUser } from '../helpers/db';
import { memoryStorage } from '../helpers/storage';
import { fakeMailer } from '../helpers/mail';
import { jobs, pages, users } from '@/db/schema';
import { autoDeliverStale, deliverPending, notifyReview, REVIEW_AUTO_DELIVER_DAYS } from '@/lib/jobs/deliver';
import { maybeCompleteJob } from '@/lib/jobs/progress';

async function job(status: 'delivering' | 'failed' | 'review' | 'processing') {
  const db = await testDb();
  const storage = memoryStorage();
  const u = await makeUser(db, 'ogretmen@okul.k12.tr', 0);
  const [j] = await db.insert(jobs).values({ userId: u.id, title: '9-B', status, reservedPages: 2 }).returning();
  await storage.write('jobs/a/k.jpg', Buffer.from('k'));
  await storage.write('jobs/a/s1.jpg', Buffer.from('s'));
  await storage.write('jobs/a/s2.jpg', Buffer.from('s'));
  await db.insert(pages).values([
    { jobId: j.id, kind: 'key', seq: 1, filePath: 'jobs/a/k.jpg', status: status === 'failed' ? 'failed' : 'read', error: status === 'failed' ? 'key_empty' : null,
      result: status === 'failed' ? null : { type: 'key', read: { questionCount: 1, answers: [{ q: 1, option: 'A' }] } } },
    { jobId: j.id, kind: 'student', seq: 1, filePath: 'jobs/a/s1.jpg', status: 'read',
      result: { type: 'student', read: { isBackSide: false, studentName: 'Elif', nameConfidence: 'high', unreadable: false, answers: [{ q: 1, marked: ['A'], confidence: 'high' }] } } },
    { jobId: j.id, kind: 'student', seq: 2, filePath: 'jobs/a/s2.jpg', status: 'failed', error: 'unreadable' },
  ]);
  return { db, storage, u, j };
}

describe('deliverPending', () => {
  it('mails the report, refunds failed pages, deletes photos and finishes', async () => {
    const { db, storage, u, j } = await job('delivering');
    const mailer = fakeMailer();
    expect(await deliverPending({ db, storage, mailer })).toBe(1);
    expect(mailer.sent[0].attachments!.map((a) => a.filename)).toEqual(['9-B.xlsx', '9-B-ozet.pdf']);
    // Düzeltme.md D6: no roster was set on this job (default `[]`), so the
    // mail must say so instead of silently skipping name cross-checking.
    expect(mailer.sent[0].text).toContain('çapraz kontrol edilmedi');
    expect(storage.files.size).toBe(0);
    const [job2] = await db.select().from(jobs).where(eq(jobs.id, j.id));
    expect(job2.status).toBe('done');
    expect((await db.select().from(users).where(eq(users.id, u.id)))[0].pageBalance).toBe(1);
    expect(await deliverPending({ db, storage, mailer })).toBe(0);
  });

  it('tells the teacher when the key failed and refunds everything', async () => {
    const { db, storage, u } = await job('failed');
    const mailer = fakeMailer();
    await deliverPending({ db, storage, mailer });
    expect(mailer.sent[0].subject).toContain('okunamadı');
    expect((await db.select().from(users).where(eq(users.id, u.id)))[0].pageBalance).toBe(2);
  });

  it('never mails twice when cleanup fails after the mail went out', async () => {
    const { db, storage, j } = await job('delivering');
    const mailer = fakeMailer();
    const flaky = { ...storage, remove: async () => { throw new Error('disk busy'); } };
    expect(await deliverPending({ db, storage: flaky, mailer })).toBe(1);
    const [row] = await db.select().from(jobs).where(eq(jobs.id, j.id));
    expect(row.status).toBe('done');
    expect(row.notifiedAt).not.toBeNull();
    const later = new Date(Date.now() + 60 * 60 * 1000);
    expect(await deliverPending({ db, storage, mailer }, later)).toBe(0);
    expect(mailer.sent).toHaveLength(1);
  });

  it('keeps the job for a retry when mail fails', async () => {
    const { db, storage, j } = await job('delivering');
    const broken = { send: async () => { throw new Error('smtp down'); } };
    await deliverPending({ db, storage, mailer: broken });
    const [row] = await db.select().from(jobs).where(eq(jobs.id, j.id));
    expect(row.status).toBe('delivering');
    expect(row.notifiedAt).toBeNull();
    expect(storage.files.size).toBe(3);
  });
});

// A job with an unsure read waits for the teacher. It must not wait forever:
// the unread pages come back at once, the teacher is told, and the report
// goes out on its own if nobody approves it.
describe('jobs waiting in review', () => {
  const unsure = { type: 'student' as const, read: { isBackSide: false, studentName: 'Elif', nameConfidence: 'high' as const, unreadable: false,
    answers: [{ q: 1, marked: ['A' as const], confidence: 'low' as const }] } };

  it('refunds unread pages as soon as reading ends in review', async () => {
    const { db, u, j } = await job('processing');
    await db.update(pages).set({ result: unsure }).where(and(eq(pages.kind, 'student'), eq(pages.seq, 1)));
    expect(await maybeCompleteJob(db, j.id)).toBe('review');
    expect((await db.select().from(users).where(eq(users.id, u.id)))[0].pageBalance).toBe(1);
    // approving later must not refund the same page twice
    await db.update(jobs).set({ status: 'delivering' }).where(eq(jobs.id, j.id));
    const storage = memoryStorage();
    await deliverPending({ db, storage, mailer: fakeMailer() });
    expect((await db.select().from(users).where(eq(users.id, u.id)))[0].pageBalance).toBe(1);
  });

  it('tells the teacher once that the exam waits for them', async () => {
    const { db, storage, j } = await job('review');
    const mailer = fakeMailer();
    expect(await notifyReview({ db, storage, mailer })).toBe(1);
    expect(mailer.sent[0].subject).toBe('9-B: kontrolünüz bekleniyor');
    expect(mailer.sent[0].text).toContain(`${REVIEW_AUTO_DELIVER_DAYS} gün içinde onaylamazsanız`);
    expect(await notifyReview({ db, storage, mailer })).toBe(0);
    expect((await db.select().from(jobs).where(eq(jobs.id, j.id)))[0].reviewNotifiedAt).not.toBeNull();
  });

  it('sends the report as read when nobody approves it in time', async () => {
    const { db, storage, j } = await job('review');
    const finished = new Date('2026-09-01T10:00:00Z');
    await db.update(jobs).set({ finishedAt: finished }).where(eq(jobs.id, j.id));
    const justBefore = new Date(finished.getTime() + REVIEW_AUTO_DELIVER_DAYS * 86_400_000 - 60_000);
    expect(await autoDeliverStale(db, justBefore)).toBe(0);
    expect(await autoDeliverStale(db, new Date(finished.getTime() + REVIEW_AUTO_DELIVER_DAYS * 86_400_000 + 60_000))).toBe(1);
    const mailer = fakeMailer();
    await deliverPending({ db, storage, mailer });
    expect(mailer.sent[0].text).toContain('onaylanmadığı için rapor, okunduğu haliyle gönderildi');
    expect((await db.select().from(jobs).where(eq(jobs.id, j.id)))[0].status).toBe('done');
    expect(storage.files.size).toBe(0);
  });
});
