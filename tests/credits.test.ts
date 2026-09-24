import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb, makeUser } from './helpers/db';
import { grantPages, refundPages } from '@/lib/credits';
import { users } from '@/db/schema';

const balance = async (db: any, id: string) =>
  (await db.select().from(users).where(eq(users.id, id)))[0].pageBalance;

describe('credits', () => {
  it('grants once per payment reference', async () => {
    const db = await testDb();
    const u = await makeUser(db);
    expect(await grantPages(db, u.id, 150, 'purchase', 'pay-1')).toBe(true);
    expect(await grantPages(db, u.id, 150, 'purchase', 'pay-1')).toBe(false);
    expect(await balance(db, u.id)).toBe(150);
  });
  it('refunds a job at most once', async () => {
    const db = await testDb();
    const u = await makeUser(db);
    await refundPages(db, u.id, 3, 'job-1');
    await refundPages(db, u.id, 3, 'job-1');
    expect(await balance(db, u.id)).toBe(3);
  });
  it('does nothing for a zero refund', async () => {
    const db = await testDb();
    const u = await makeUser(db);
    expect(await refundPages(db, u.id, 0, 'job-2')).toBe(false);
  });
});
