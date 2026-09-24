import { and, count, eq, inArray } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { jobs, pages } from '@/db/schema';
import { buildReportInput } from '@/lib/report/input';

// Called after every page settles. Only the call that flips the status wins,
// so two workers finishing the last two pages cannot both advance the job.
export async function maybeCompleteJob(db: Db, jobId: string): Promise<'delivering' | 'review' | 'failed' | null> {
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
  if (next === 'delivering') {
    const [job] = await db.select({ mode: jobs.mode }).from(jobs).where(eq(jobs.id, jobId));
    // klasik scores are suggestions and always need the teacher (Task 15)
    if (job?.mode === 'klasik' || (await buildReportInput(db, jobId)).needsReview) next = 'review';
  }

  const moved = await db.update(jobs).set({ status: next, finishedAt: new Date() })
    .where(and(eq(jobs.id, jobId), inArray(jobs.status, ['queued', 'processing'])))
    .returning({ id: jobs.id });
  return moved.length ? next : null;
}
