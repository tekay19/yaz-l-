import { and, eq, inArray, isNotNull, lt, ne, or, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { events, jobs, loginTokens, pages, users } from '@/db/schema';
import type { Storage } from '@/lib/storage';

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

async function removePhotos(db: Db, storage: Storage, jobIds: string[]) {
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

export async function runRetention(db: Db, storage: Storage, now = new Date()) {
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
  const gone = await db.delete(jobs).where(lt(jobs.createdAt, ago(now, RESULT_TTL_DAYS))).returning({ id: jobs.id });
  await db.delete(loginTokens).where(lt(loginTokens.createdAt, ago(now, 1)));
  await db.delete(events).where(lt(events.ts, ago(now, EVENT_TTL_DAYS)));
  return { photos, jobs: gone.length };
}

export async function deleteAccount(db: Db, storage: Storage, userId: string) {
  const mine = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.userId, userId));
  await removePhotos(db, storage, mine.map((j) => j.id));
  await db.delete(users).where(eq(users.id, userId)); // cascades jobs, pages, ledger; payments keep a null user
}
