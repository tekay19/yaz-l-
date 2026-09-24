import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb, makeUser } from '../helpers/db';
import { jobs, pages, ledger, users } from '@/db/schema';

describe('schema', () => {
  it('cascades a user delete to jobs and pages', async () => {
    const db = await testDb();
    const u = await makeUser(db);
    const [j] = await db.insert(jobs).values({ userId: u.id }).returning();
    await db.insert(pages).values({ jobId: j.id, kind: 'student', seq: 1, filePath: 'x.jpg' });
    await db.delete(users).where(eq(users.id, u.id));
    expect(await db.select().from(pages)).toHaveLength(0);
  });

  it('rejects a second ledger row with the same reason and ref', async () => {
    const db = await testDb();
    const u = await makeUser(db);
    await db.insert(ledger).values({ userId: u.id, delta: 5, reason: 'purchase', ref: 'p1' });
    await expect(
      db.insert(ledger).values({ userId: u.id, delta: 5, reason: 'purchase', ref: 'p1' }),
    ).rejects.toThrow();
  });
});
