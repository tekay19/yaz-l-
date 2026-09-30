import { and, count, eq, inArray } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { jobs, pages } from '@/db/schema';
import { buildReportInput, type ReportInput } from '@/lib/report/input';
import { refundPages } from '@/lib/credits';

// Called after every page settles. Only the call that flips the status wins,
// so two workers finishing the last two pages cannot both advance the job.
export async function maybeCompleteJob(db: Db, jobId: string): Promise<'delivering' | 'review' | 'failed' | null> {
  const [job] = await db.select({ mode: jobs.mode, userId: jobs.userId }).from(jobs).where(eq(jobs.id, jobId));
  // klasik jobs wait for their rubric and grades; lib/klasik/worker.ts moves them on
  if (!job || job.mode === 'klasik') return null;
  const [key] = await db.select({ status: pages.status }).from(pages)
    .where(and(eq(pages.jobId, jobId), eq(pages.kind, 'key')));
  if (key?.status === 'failed') {
    // students are never claimed without a read key; settle them now
    await db.update(pages).set({ status: 'failed', error: 'key_failed', leaseUntil: null })
      .where(and(eq(pages.jobId, jobId), eq(pages.status, 'queued')));
  }

  const [{ pending }] = await db.select({ pending: count() }).from(pages)
    .where(and(eq(pages.jobId, jobId), inArray(pages.status, ['queued', 'reading'])));
  if (pending > 0) return null;

  let next: 'delivering' | 'review' | 'failed' = key?.status === 'read' ? 'delivering' : 'failed';
  let input: ReportInput | null = null;
  if (next === 'delivering') {
    input = await buildReportInput(db, jobId);
    if (input.needsReview) next = 'review';
  }

  const moved = await db.update(jobs).set({ status: next, finishedAt: new Date() })
    .where(and(eq(jobs.id, jobId), inArray(jobs.status, ['queued', 'processing'])))
    .returning({ id: jobs.id });
  if (!moved.length) return null;
  // Unread pages are given back as soon as reading ends, not when the report
  // goes out: a job can wait in review for days. The ledger's (reason, ref)
  // key makes the refund at delivery a no-op afterwards.
  if (next === 'review' && input?.failed.length) await refundPages(db, job.userId, input.failed.length, jobId);
  return next;
}
