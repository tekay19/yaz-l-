import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb, makeUser } from '../helpers/db';
import { memoryStorage } from '../helpers/storage';
import { JobLockedError, addPage, createJob, getOwnedJob, removePage } from '@/lib/jobs/pages';
import { jobs, pages } from '@/db/schema';

describe('pages', () => {
  it('numbers student pages and keeps a single key page', async () => {
    const db = await testDb();
    const st = memoryStorage();
    const u = await makeUser(db);
    const { id } = await createJob(db, u.id, { title: '9-B', mode: 'optik' });
    const a = await addPage(db, st, { jobId: id, kind: 'student', image: Buffer.from('1') });
    const b = await addPage(db, st, { jobId: id, kind: 'student', image: Buffer.from('2') });
    expect([a.seq, b.seq]).toEqual([1, 2]);
    await addPage(db, st, { jobId: id, kind: 'key', image: Buffer.from('k1') });
    await addPage(db, st, { jobId: id, kind: 'key', image: Buffer.from('k2') });
    const keys = await db.select().from(pages).where(eq(pages.kind, 'key'));
    expect(keys).toHaveLength(1);
    expect(st.files.size).toBe(3);
  });

  it('hides jobs from other users', async () => {
    const db = await testDb();
    const owner = await makeUser(db, 'a@b.co');
    const other = await makeUser(db, 'c@d.co');
    const { id } = await createJob(db, owner.id, { title: 'x', mode: 'optik' });
    expect(await getOwnedJob(db, id, other.id)).toBeNull();
    expect(await getOwnedJob(db, id, owner.id)).not.toBeNull();
  });

  it('removes a page and its file', async () => {
    const db = await testDb();
    const st = memoryStorage();
    const u = await makeUser(db);
    const { id } = await createJob(db, u.id, { title: 'x', mode: 'optik' });
    const p = await addPage(db, st, { jobId: id, kind: 'student', image: Buffer.from('1') });
    expect(await removePage(db, st, id, p.id)).toBe(true);
    expect(st.files.size).toBe(0);
  });

  it('refuses pages for a submitted job and leaves no file behind', async () => {
    const db = await testDb();
    const st = memoryStorage();
    const u = await makeUser(db);
    const { id } = await createJob(db, u.id, { title: 'x', mode: 'optik' });
    await db.update(jobs).set({ status: 'queued' }).where(eq(jobs.id, id));
    await expect(addPage(db, st, { jobId: id, kind: 'student', image: Buffer.from('1') }))
      .rejects.toBeInstanceOf(JobLockedError);
    expect(st.files.size).toBe(0);
  });
});
