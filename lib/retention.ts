import { and, eq, inArray, isNotNull, lt, ne, notInArray, or, sql, type SQL } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { authTokens, events, jobs, pages, users } from '@/db/schema';
import type { Storage } from '@/lib/storage';
import { refundPages } from '@/lib/credits';

export const PHOTO_TTL_DAYS = 7;
// Düzeltme.md D5: a job still in the pipeline (being read, waiting for its
// rubric or for the teacher's check) keeps its photos past the normal 7 days
// — the review screen needs them — but never past this backstop, paid or not,
// so nothing lingers indefinitely just because it was never approved.
export const REVIEW_PHOTO_TTL_DAYS = 14;
export const RESULT_TTL_DAYS = 30;
export const EVENT_TTL_DAYS = 180;
const ago = (now: Date, d: number) => new Date(now.getTime() - d * 86_400_000);

// "sent more than `days` ago", counting a sent job from its submission. Raw
// SQL has no column to encode a Date with, and the postgres driver refuses a
// Date object there (PGlite, used in tests, does not): the cutoff goes in as
// ISO text and is cast.
export const sentBefore = (now: Date, days: number) =>
  sql`coalesce(${jobs.submittedAt}, ${jobs.createdAt}) < ${ago(now, days).toISOString()}::timestamptz`;

const finishedBefore = (now: Date, days: number) =>
  sql`coalesce(${jobs.finishedAt}, ${jobs.submittedAt}, ${jobs.createdAt}) < ${ago(now, days).toISOString()}::timestamptz`;

export async function removePhotos(db: Db, storage: Storage, jobIds: string[]) {
  if (!jobIds.length) return 0;
  const withPhoto = and(inArray(pages.jobId, jobIds), isNotNull(pages.filePath));
  const rows = await db.select({ filePath: pages.filePath }).from(pages).where(withPhoto);
  for (const r of rows) await storage.remove(r.filePath!);
  await db.update(pages).set({ filePath: null }).where(withPhoto);
  return rows.length;
}

// A draft nobody sent within a week is emptied, rows and all: a draft with
// photo-less pages would only fail later, when it is finally submitted.
async function removeDraftPages(db: Db, storage: Storage, jobIds: string[]) {
  if (!jobIds.length) return 0;
  const rows = await db.delete(pages).where(inArray(pages.jobId, jobIds)).returning({ filePath: pages.filePath });
  for (const r of rows) if (r.filePath) await storage.remove(r.filePath);
  return rows.filter((r) => r.filePath).length;
}

// A job that never finished (a klasik exam left in review, a stuck one) is
// not deleted silently: it is closed as failed, and delivery mails the
// teacher and refunds what is still reserved. It is deleted only after that.
export const closeStaleJobs = (db: Db, now = new Date()) =>
  closeJobs(db, sentBefore(now, RESULT_TTL_DAYS), 'review_expired', now);

// Closes the unfinished jobs matching `where` as failed; delivery then
// refunds what is left reserved and tells the teacher why.
export async function closeJobs(db: Db, where: SQL | undefined, reason: 'review_expired' | 'admin_closed', now = new Date()) {
  const closed = await db.update(jobs).set({ status: 'failed', failReason: reason, finishedAt: now })
    .where(and(notInArray(jobs.status, ['draft', 'done', 'failed']), where))
    .returning({ id: jobs.id });
  if (closed.length) {
    await db.update(pages).set({ status: 'failed', error: 'job_cancelled', leaseUntil: null })
      .where(and(inArray(pages.jobId, closed.map((j) => j.id)), inArray(pages.status, ['queued', 'reading'])));
  }
  return closed.length;
}

export async function runRetention(db: Db, storage: Storage, now = new Date()) {
  const closed = await closeStaleJobs(db, now);
  const drafts = await db.select({ id: jobs.id }).from(jobs)
    .where(and(eq(jobs.status, 'draft'), lt(jobs.createdAt, ago(now, PHOTO_TTL_DAYS))));
  const draftPhotos = await removeDraftPages(db, storage, drafts.map((j) => j.id));
  // A sent job counts from the day it was sent, not from when its draft was
  // opened: a draft prepared a week ahead must keep its photos while it is
  // read, waits for its rubric or waits for the teacher's check.
  const stale = await db.select({ id: jobs.id }).from(jobs).where(or(
    and(inArray(jobs.status, ['delivering', 'done', 'failed']), sentBefore(now, PHOTO_TTL_DAYS)),
    and(ne(jobs.status, 'draft'), sentBefore(now, REVIEW_PHOTO_TTL_DAYS)), // backstop, whatever it waits for
  ));
  const photos = draftPhotos + await removePhotos(db, storage, stale.map((j) => j.id));
  // Only finished jobs go. A finished exam keeps its results for 30 days from
  // the day they were ready, not from when its draft was opened: an exam
  // prepared weeks ahead would otherwise vanish the day after delivery. A
  // failed one goes once the teacher has been told, 30 days after it was sent.
  const gone = await db.delete(jobs).where(or(
    and(eq(jobs.status, 'draft'), lt(jobs.createdAt, ago(now, RESULT_TTL_DAYS))),
    and(eq(jobs.status, 'done'), finishedBefore(now, RESULT_TTL_DAYS)),
    and(eq(jobs.status, 'failed'), isNotNull(jobs.notifiedAt), sentBefore(now, RESULT_TTL_DAYS)),
  )).returning({ id: jobs.id });
  await db.delete(authTokens).where(lt(authTokens.expiresAt, ago(now, 1)));
  await db.delete(events).where(lt(events.ts, ago(now, EVENT_TTL_DAYS)));
  return { closed, photos, jobs: gone.length };
}

// The teacher deletes an exam from the list: the photos and every row go at
// once. Never while it is queued, read or graded (a worker holds its pages).
// An exam waiting for its key had nothing graded: its reserved pages come
// back, as they would on its cancellation.
export const DELETABLE_STATUSES = ['draft', 'rubric', 'review', 'delivering', 'done', 'failed'] as const;

export async function deleteJob(db: Db, storage: Storage, jobId: string): Promise<boolean> {
  const files = await db.select({ filePath: pages.filePath }).from(pages)
    .where(and(eq(pages.jobId, jobId), isNotNull(pages.filePath)));
  const [gone] = await db.delete(jobs).where(and(eq(jobs.id, jobId), inArray(jobs.status, [...DELETABLE_STATUSES])))
    .returning({ userId: jobs.userId, status: jobs.status, reservedPages: jobs.reservedPages });
  if (!gone) return false;
  if (gone.status === 'rubric') await refundPages(db, gone.userId, gone.reservedPages, jobId);
  for (const f of files) await storage.remove(f.filePath!).catch(() => undefined);
  return true;
}

export async function deleteAccount(db: Db, storage: Storage, userId: string) {
  const mine = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.userId, userId));
  await removePhotos(db, storage, mine.map((j) => j.id));
  await db.delete(users).where(eq(users.id, userId)); // cascades jobs, pages, ledger; payments keep a null user
}
