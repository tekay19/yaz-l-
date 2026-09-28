import { and, asc, desc, eq, gte, inArray, lt, or, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { jobs, pages } from '@/db/schema';
import type { PageResult } from '@/lib/types';
import type { Usage } from '@/lib/reader/claude';

export const MAX_ATTEMPTS = 3;
export const LEASE_MS = 5 * 60 * 1000;
// Pause before a retryable failure is read again. Most failures are a single
// dropped connection, so the first retry comes quickly: the whole class waits
// for its slowest page. A second failure looks like an outage and backs off
// longer, so three attempts still outlast a short one.
export const FIRST_RETRY_MS = 20 * 1000;
export const RETRY_BACKOFF_MS = 2 * 60 * 1000;
export const retryBackoffMs = (attempts: number) => (attempts <= 1 ? FIRST_RETRY_MS : RETRY_BACKOFF_MS);

export type ClaimedPage = { id: string; jobId: string; kind: 'key' | 'student'; filePath: string | null; attempts: number };

// SKIP LOCKED lets several workers pull from the same table without ever
// receiving the same page; an expired lease means the worker died mid-read.
// Student pages wait until their job's key is read: the question count and
// the key text come from it, and a failed key must stop the job cheaply.
export async function claimPages(db: Db, limit: number, now = new Date()): Promise<ClaimedPage[]> {
  return db.transaction(async (tx) => {
    const picked = await tx.select({ id: pages.id }).from(pages)
      .where(and(
        or(
          eq(pages.status, 'queued'),
          and(eq(pages.status, 'reading'), lt(pages.leaseUntil, now), lt(pages.attempts, MAX_ATTEMPTS)),
        ),
        or(
          eq(pages.kind, 'key'),
          sql`exists (select 1 from pages k where k.job_id = ${pages.jobId} and k.kind = 'key' and k.status = 'read')`,
        ),
      ))
      .orderBy(desc(sql`${pages.kind} = 'key'`), asc(pages.createdAt))
      .limit(limit)
      .for('update', { skipLocked: true });
    if (!picked.length) return [];
    const rows = await tx.update(pages)
      .set({ status: 'reading', attempts: sql`${pages.attempts} + 1`, leaseUntil: new Date(now.getTime() + LEASE_MS) })
      .where(inArray(pages.id, picked.map((p) => p.id)))
      .returning({ id: pages.id, jobId: pages.jobId, kind: pages.kind, filePath: pages.filePath, attempts: pages.attempts });
    await tx.update(jobs).set({ status: 'processing' })
      .where(and(inArray(jobs.id, [...new Set(rows.map((r) => r.jobId))]), eq(jobs.status, 'queued')));
    return rows;
  });
}

export async function completePage(db: Db, pageId: string, result: PageResult, usage: Usage) {
  await db.update(pages).set({
    status: 'read', result, error: null, leaseUntil: null,
    inputTokens: sql`${pages.inputTokens} + ${usage.inputTokens}`,
    outputTokens: sql`${pages.outputTokens} + ${usage.outputTokens}`,
  }).where(eq(pages.id, pageId));
}

export async function failPage(db: Db, pageId: string, message: string, retry: boolean, now = new Date()) {
  const error = message.slice(0, 500);
  if (retry) {
    // parked as a lease that runs out after the backoff: claimPages offers an
    // expired 'reading' page again, exactly as after a worker crash
    const [row] = await db.select({ attempts: pages.attempts }).from(pages).where(eq(pages.id, pageId));
    const requeued = await db.update(pages)
      .set({ status: 'reading', error, leaseUntil: new Date(now.getTime() + retryBackoffMs(row?.attempts ?? MAX_ATTEMPTS)) })
      .where(and(eq(pages.id, pageId), lt(pages.attempts, MAX_ATTEMPTS)))
      .returning({ id: pages.id });
    if (requeued.length) return;
  }
  await db.update(pages).set({ status: 'failed', error, leaseUntil: null }).where(eq(pages.id, pageId));
}

export async function sweepExhausted(db: Db, now = new Date()): Promise<string[]> {
  const rows = await db.update(pages).set({ status: 'failed', error: 'max_attempts', leaseUntil: null })
    .where(and(eq(pages.status, 'reading'), lt(pages.leaseUntil, now), gte(pages.attempts, MAX_ATTEMPTS)))
    .returning({ jobId: pages.jobId });
  return [...new Set(rows.map((r) => r.jobId))];
}
