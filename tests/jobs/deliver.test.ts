import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb, makeUser } from '../helpers/db';
import { memoryStorage } from '../helpers/storage';
import { fakeMailer } from '../helpers/mail';
import { jobs, pages, users } from '@/db/schema';
import { deliverPending } from '@/lib/jobs/deliver';

async function job(status: 'delivering' | 'failed') {
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
