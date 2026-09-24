import { eq, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { ledger, users } from '@/db/schema';

type Reason = 'purchase' | 'admin_grant' | 'job_refund';

// Adds pages and writes the ledger row in one transaction. The unique
// (reason, ref) index makes a replayed payment callback or refund a no-op.
async function credit(db: Db, userId: string, pages: number, reason: Reason, ref: string) {
  if (pages <= 0) return false;
  return db.transaction(async (tx) => {
    const inserted = await tx.insert(ledger)
      .values({ userId, delta: pages, reason, ref })
      .onConflictDoNothing({ target: [ledger.reason, ledger.ref] })
      .returning({ id: ledger.id });
    if (!inserted.length) return false;
    await tx.update(users).set({ pageBalance: sql`${users.pageBalance} + ${pages}` }).where(eq(users.id, userId));
    return true;
  });
}

export const grantPages = (db: Db, userId: string, pages: number, reason: 'purchase' | 'admin_grant', ref: string) =>
  credit(db, userId, pages, reason, ref);

export const refundPages = (db: Db, userId: string, pages: number, jobId: string) =>
  credit(db, userId, pages, 'job_refund', jobId);
