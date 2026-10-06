import { and, count, desc, eq, ilike, inArray, lt, or, sql, type SQL } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { jobs, ledger, pages, users } from '@/db/schema';
import { HttpError } from '@/lib/http';
import { closeJobs } from '@/lib/retention';
import { logAction, type Actor } from './guard';
import { OPEN_STATUSES, STUCK_HOURS } from './overview';

export const JOB_FILTERS = ['all', 'open', 'stuck', 'review', 'done', 'failed', 'draft'] as const;
export type JobFilter = (typeof JOB_FILTERS)[number];

const stuckCond = (now: Date) => and(
  inArray(jobs.status, ['queued', 'processing', 'delivering']),
  lt(jobs.submittedAt, new Date(now.getTime() - STUCK_HOURS * 3_600_000)),
);

const pageCounts = {
  pages: sql<number>`(select count(*) from ${pages} where ${pages.jobId} = ${jobs.id} and ${pages.kind} = 'student')::int`,
  readPages: sql<number>`(select count(*) from ${pages} where ${pages.jobId} = ${jobs.id} and ${pages.kind} = 'student' and ${pages.status} = 'read')::int`,
  failedPages: sql<number>`(select count(*) from ${pages} where ${pages.jobId} = ${jobs.id} and ${pages.status} = 'failed')::int`,
};

export async function listJobs(db: Db, opts: { q?: string; filter?: JobFilter; mode?: string; offset: number; size: number }, now = new Date()) {
  const where: (SQL | undefined)[] = [];
  const q = (opts.q || '').trim().slice(0, 100);
  if (q) where.push(or(ilike(users.email, `%${q}%`), ilike(jobs.title, `%${q}%`)));
  if (opts.mode === 'optik' || opts.mode === 'klasik') where.push(eq(jobs.mode, opts.mode));
  switch (opts.filter) {
    case 'open': where.push(inArray(jobs.status, [...OPEN_STATUSES])); break;
    case 'stuck': where.push(stuckCond(now)); break;
    case 'review': where.push(inArray(jobs.status, ['rubric', 'review'])); break;
    case 'done': case 'failed': case 'draft': where.push(eq(jobs.status, opts.filter)); break;
  }
  const cond = and(...where);
  const [rows, [total]] = await Promise.all([
    db.select({
      id: jobs.id, title: jobs.title, mode: jobs.mode, status: jobs.status, failReason: jobs.failReason,
      reservedPages: jobs.reservedPages, createdAt: jobs.createdAt, submittedAt: jobs.submittedAt, finishedAt: jobs.finishedAt,
      userId: jobs.userId, email: users.email, ...pageCounts,
    }).from(jobs).innerJoin(users, eq(users.id, jobs.userId)).where(cond)
      .orderBy(desc(sql`coalesce(${jobs.submittedAt}, ${jobs.createdAt})`)).limit(opts.size).offset(opts.offset),
    db.select({ n: count() }).from(jobs).innerJoin(users, eq(users.id, jobs.userId)).where(cond),
  ]);
  return { rows, total: Number(total.n) };
}

export async function jobDetail(db: Db, id: string) {
  const [job] = await db.select({
    id: jobs.id, title: jobs.title, mode: jobs.mode, status: jobs.status, failReason: jobs.failReason,
    reservedPages: jobs.reservedPages, rosterSize: sql<number>`jsonb_array_length(${jobs.roster})::int`,
    createdAt: jobs.createdAt, submittedAt: jobs.submittedAt, finishedAt: jobs.finishedAt, notifiedAt: jobs.notifiedAt,
    rubricApprovedAt: jobs.rubricApprovedAt, autoDeliveredAt: jobs.autoDeliveredAt,
    userId: jobs.userId, email: users.email,
  }).from(jobs).innerJoin(users, eq(users.id, jobs.userId)).where(eq(jobs.id, id));
  if (!job) return null;
  const [pageRows, refunds] = await Promise.all([
    db.select({
      id: pages.id, kind: pages.kind, seq: pages.seq, status: pages.status, attempts: pages.attempts,
      error: pages.error, inputTokens: pages.inputTokens, outputTokens: pages.outputTokens,
      hasPhoto: sql<boolean>`${pages.filePath} is not null`, graded: sql<boolean>`${pages.grade} is not null`,
    }).from(pages).where(eq(pages.jobId, id)).orderBy(pages.kind, pages.seq),
    db.select({ delta: ledger.delta, ref: ledger.ref, createdAt: ledger.createdAt }).from(ledger)
      .where(and(eq(ledger.reason, 'job_refund'), or(eq(ledger.ref, id), ilike(ledger.ref, `${id}:%`)))),
  ]);
  // only counts and states: the panel never shows the students' answers or names
  return { job, pages: pageRows, refunded: refunds.reduce((n, r) => n + r.delta, 0) };
}

// Closes an unfinished exam; delivery refunds the unused pages and tells the teacher.
export async function closeJob(db: Db, admin: Actor, jobId: string, note: string) {
  if (note.trim().length < 3) throw new HttpError(400, 'Gerekçe yazın.');
  const [job] = await db.select({ status: jobs.status, title: jobs.title }).from(jobs).where(eq(jobs.id, jobId));
  if (!job) throw new HttpError(404, 'Sınav bulunamadı.');
  const closed = await closeJobs(db, eq(jobs.id, jobId), 'admin_closed');
  if (!closed) throw new HttpError(409, 'Bu sınav kapatılamaz: taslak, tamamlanmış ya da zaten kapanmış.');
  await logAction(db, admin, 'job.close', 'job', jobId, { title: job.title, from: job.status, note: note.trim().slice(0, 300) });
}
