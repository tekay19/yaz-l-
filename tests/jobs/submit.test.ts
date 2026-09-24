import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb, makeUser } from '../helpers/db';
import { memoryStorage } from '../helpers/storage';
import { addPage, createJob } from '@/lib/jobs/pages';
import { submitJob } from '@/lib/jobs/submit';
import { jobs, pages, users } from '@/db/schema';

async function setup(balance: number, students: number, withKey = true) {
  const db = await testDb();
  const st = memoryStorage();
  const u = await makeUser(db, 'a@b.co', balance);
  const { id } = await createJob(db, u.id, { title: 't', mode: 'optik' });
  if (withKey) await addPage(db, st, { jobId: id, kind: 'key', image: Buffer.from('k') });
  for (let i = 0; i < students; i++) await addPage(db, st, { jobId: id, kind: 'student', image: Buffer.from(String(i)) });
  return { db, u, id };
}

describe('submitJob', () => {
  it('reserves one credit per student page and queues every page', async () => {
    const { db, u, id } = await setup(10, 3);
    expect(await submitJob(db, id, u.id, true)).toEqual({ ok: true, reserved: 3 });
    const [user] = await db.select().from(users).where(eq(users.id, u.id));
    expect(user.pageBalance).toBe(7);
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    expect(job.status).toBe('queued');
    const statuses = (await db.select().from(pages)).map((p) => p.status);
    expect(new Set(statuses)).toEqual(new Set(['queued']));
  });
  it('refuses without enough credit and changes nothing', async () => {
    const { db, u, id } = await setup(2, 3);
    expect(await submitJob(db, id, u.id, true)).toEqual({ ok: false, error: 'insufficient', need: 3, have: 2 });
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    expect(job.status).toBe('draft');
  });
  it('requires a key page, student pages and consent', async () => {
    expect((await (async () => { const s = await setup(5, 1, false); return submitJob(s.db, s.id, s.u.id, true); })())).toMatchObject({ error: 'no_key' });
    expect((await (async () => { const s = await setup(5, 0); return submitJob(s.db, s.id, s.u.id, true); })())).toMatchObject({ error: 'no_pages' });
    expect((await (async () => { const s = await setup(5, 1); return submitJob(s.db, s.id, s.u.id, false); })())).toMatchObject({ error: 'no_consent' });
  });
  it('cannot be submitted twice', async () => {
    const { db, u, id } = await setup(10, 1);
    await submitJob(db, id, u.id, true);
    expect(await submitJob(db, id, u.id, true)).toMatchObject({ error: 'not_draft' });
  });
});
