import { and, eq, inArray, isNotNull, lt, ne, or } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { events, jobs, loginTokens, pages, users } from '@/db/schema';
import type { Storage } from '@/lib/storage';

export const PHOTO_TTL_DAYS = 7;
// Düzeltme.md D5: a job waiting in `review` keeps its photos past the normal
// 7 days — the review screen needs them — but never past this backstop, paid
// or not, so nothing lingers indefinitely just because it was never approved.
export const REVIEW_PHOTO_TTL_DAYS = 14;
export const RESULT_TTL_DAYS = 30;
export const EVENT_TTL_DAYS = 180;
const ago = (now: Date, d: number) => new Date(now.getTime() - d * 86_400_000);

async function removePhotos(db: Db, storage: Storage, jobIds: string[]) {
  if (!jobIds.length) return 0;
  const rows = await db.select({ filePath: pages.filePath }).from(pages)
    .where(and(inArray(pages.jobId, jobIds), isNotNull(pages.filePath)));
  for (const r of rows) await storage.remove(r.filePath!);
  await db.update(pages).set({ filePath: null }).where(inArray(pages.jobId, jobIds));
  return rows.length;
}

export async function runRetention(db: Db, storage: Storage, now = new Date()) {
  const stale = await db.select({ id: jobs.id }).from(jobs).where(or(
    and(ne(jobs.status, 'review'), lt(jobs.createdAt, ago(now, PHOTO_TTL_DAYS))),
    lt(jobs.createdAt, ago(now, REVIEW_PHOTO_TTL_DAYS)), // backstop, review or not
  ));
  const photos = await removePhotos(db, storage, stale.map((j) => j.id));
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
