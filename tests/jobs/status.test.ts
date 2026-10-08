import { describe, expect, it } from 'vitest';
import { testDb, makeUser } from '../helpers/db';
import { jobs, pages } from '@/db/schema';
import { jobStatus, listJobs } from '@/lib/jobs/status';

describe('job status', () => {
  it('counts pages by kind and state', async () => {
    const db = await testDb();
    const u = await makeUser(db);
    const [j] = await db.insert(jobs).values({ userId: u.id, title: 't', status: 'processing' }).returning();
    await db.insert(pages).values([
      { jobId: j.id, kind: 'key', seq: 1, status: 'read' },
      { jobId: j.id, kind: 'student', seq: 1, status: 'read' },
      { jobId: j.id, kind: 'student', seq: 2, status: 'reading' },
      { jobId: j.id, kind: 'student', seq: 3, status: 'failed' },
    ]);
    expect((await jobStatus(db, j.id)).pages).toEqual({ key: 1, students: 3, read: 1, failed: 1, graded: 0 });
    expect(await listJobs(db, u.id)).toHaveLength(1);
  });
});
