import { and, count, eq, gte, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { jobs, ledger, pages, users } from '@/db/schema';

export type SubmitResult =
  | { ok: true; reserved: number }
  | { ok: false; error: 'no_key' | 'no_pages' | 'no_consent' | 'insufficient' | 'not_draft'; need?: number; have?: number };

export async function submitJob(db: Db, jobId: string, userId: string, consent: boolean): Promise<SubmitResult> {
  if (!consent) return { ok: false, error: 'no_consent' };
  return db.transaction(async (tx) => {
    const [job] = await tx.select().from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId))).for('update');
    if (!job || job.status !== 'draft') return { ok: false, error: 'not_draft' } as const;

    const counts = await tx.select({ kind: pages.kind, n: count() }).from(pages)
      .where(eq(pages.jobId, jobId)).groupBy(pages.kind);
    const keyCount = counts.find((c) => c.kind === 'key')?.n ?? 0;
    const need = counts.find((c) => c.kind === 'student')?.n ?? 0;
    if (!keyCount) return { ok: false, error: 'no_key' } as const;
    if (!need) return { ok: false, error: 'no_pages' } as const;

    const debited = await tx.update(users)
      .set({ pageBalance: sql`${users.pageBalance} - ${need}` })
      .where(and(eq(users.id, userId), gte(users.pageBalance, need)))
      .returning({ balance: users.pageBalance });
    if (!debited.length) {
      const [u] = await tx.select({ b: users.pageBalance }).from(users).where(eq(users.id, userId));
      return { ok: false, error: 'insufficient', need, have: u?.b ?? 0 } as const;
    }

    await tx.insert(ledger).values({ userId, delta: -need, reason: 'job_reserve', ref: jobId });
    await tx.update(pages).set({ status: 'queued' }).where(eq(pages.jobId, jobId));
    await tx.update(jobs).set({
      status: 'queued', reservedPages: need, consentAt: new Date(), submittedAt: new Date(),
    }).where(eq(jobs.id, jobId));
    return { ok: true, reserved: need } as const;
  });
}
