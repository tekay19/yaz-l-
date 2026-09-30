import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb, makeUser } from './helpers/db';
import { memoryStorage } from './helpers/storage';
import { addPage, createJob } from '@/lib/jobs/pages';
import { submitJob } from '@/lib/jobs/submit';
import { claimPages, completePage, failPage, sweepExhausted, MAX_ATTEMPTS, LEASE_MS, FIRST_RETRY_MS, RETRY_BACKOFF_MS } from '@/lib/queue';
import { jobs, pages } from '@/db/schema';

const keyRow = async (db: any) => (await db.select().from(pages).where(eq(pages.kind, 'key')))[0];

async function queued(students = 2) {
  const db = await testDb();
  const st = memoryStorage();
  const u = await makeUser(db, 'a@b.co', 100);
  const { id } = await createJob(db, u.id, { title: 't', mode: 'optik' });
  await addPage(db, st, { jobId: id, kind: 'key', image: Buffer.from('k') });
  for (let i = 0; i < students; i++) await addPage(db, st, { jobId: id, kind: 'student', image: Buffer.from('s') });
  await submitJob(db, id, u.id, true, true);
  return { db, id };
}

describe('queue', () => {
  it('holds students back until the key is read, then never hands a page out twice', async () => {
    const { db, id } = await queued(2);
    const first = await claimPages(db, 10);
    expect(first.map((p) => p.kind)).toEqual(['key']);
    expect(await claimPages(db, 10)).toHaveLength(0);
    await completePage(db, first[0], { type: 'key', read: { questionCount: 1, answers: [{ q: 1, option: 'A' }] } }, { inputTokens: 0, outputTokens: 0 });
    expect(await claimPages(db, 10)).toHaveLength(2);
    expect(await claimPages(db, 10)).toHaveLength(0);
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    expect(job.status).toBe('processing');
  });

  it('re-offers a page whose lease expired', async () => {
    const { db } = await queued(1);
    await claimPages(db, 10);
    const later = new Date(Date.now() + LEASE_MS + 1000);
    expect((await claimPages(db, 10, later)).map((p) => p.kind)).toEqual(['key']);
  });

  it('requeues on retryable failure and gives up after MAX_ATTEMPTS', async () => {
    const { db } = await queued(1);
    let t = Date.now();
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const [p] = await claimPages(db, 1, new Date(t));
      await failPage(db, p, 'boom', true, new Date(t));
      t += RETRY_BACKOFF_MS + 1000;
    }
    const row = await keyRow(db);
    expect(row.status).toBe('failed');
    expect(row.error).toBe('boom');
  });

  // A retryable failure (API timeout, overloaded API) must not be retried at
  // once: three back-to-back attempts fail every job during a short outage and
  // mail the teacher that their key photo was unreadable.
  it('waits out a backoff before offering a retryable failure again', async () => {
    const { db } = await queued(1);
    const t0 = Date.now();
    const [p] = await claimPages(db, 1, new Date(t0));
    await failPage(db, p, 'overloaded', true, new Date(t0));
    expect(await claimPages(db, 1, new Date(t0 + 1000))).toHaveLength(0);
    expect((await claimPages(db, 1, new Date(t0 + FIRST_RETRY_MS + 1000))).map((x) => x.id)).toEqual([p.id]);
  });

  // One dropped connection must not hold a whole class for minutes, but a
  // second failure in a row looks like an outage and waits longer.
  it('retries the first failure quickly and backs off on the second', async () => {
    const { db } = await queued(1);
    const t0 = Date.now();
    const [p] = await claimPages(db, 1, new Date(t0));
    await failPage(db, p, 'Connection error.', true, new Date(t0));
    const t1 = t0 + FIRST_RETRY_MS + 1000;
    const [again] = await claimPages(db, 1, new Date(t1));
    expect(again.id).toBe(p.id);
    await failPage(db, again, 'Connection error.', true, new Date(t1));
    expect(await claimPages(db, 1, new Date(t1 + FIRST_RETRY_MS + 1000))).toHaveLength(0);
    expect(await claimPages(db, 1, new Date(t1 + RETRY_BACKOFF_MS + 1000))).toHaveLength(1);
  });

  it('fails pages stuck in reading after the last attempt', async () => {
    const { db, id } = await queued(1);
    let t = Date.now();
    for (let i = 0; i < MAX_ATTEMPTS; i++) { await claimPages(db, 1, new Date(t)); t += LEASE_MS + 1000; }
    expect(await sweepExhausted(db, new Date(t))).toEqual([id]);
    expect((await keyRow(db)).status).toBe('failed');
  });

  // A read that outlives its lease must not settle the page: another worker
  // holds it by then. Without this a late timeout un-reads a finished page.
  it('drops a late result from a worker whose lease ran out', async () => {
    const { db } = await queued(1);
    const t0 = Date.now();
    const [stale] = await claimPages(db, 1, new Date(t0));
    const [fresh] = await claimPages(db, 1, new Date(t0 + LEASE_MS + 1000));
    expect(fresh.id).toBe(stale.id);
    const key = { type: 'key' as const, read: { questionCount: 1, answers: [{ q: 1, option: 'A' as const }] } };
    expect(await completePage(db, fresh, key, { inputTokens: 0, outputTokens: 0 })).toBe(true);
    expect(await failPage(db, stale, 'timeout', true, new Date(t0 + 10 * 60_000))).toBe(false);
    expect(await completePage(db, stale, key, { inputTokens: 0, outputTokens: 0 })).toBe(false);
    expect((await keyRow(db)).status).toBe('read');
  });
});
