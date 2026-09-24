import crypto from 'node:crypto';
import { and, eq, max } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { jobs, pages } from '@/db/schema';
import type { Storage } from '@/lib/storage';

export const MAX_STUDENT_PAGES = 200;
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export async function createJob(
  db: Db,
  userId: string,
  input: { title: string; mode: 'optik' | 'klasik'; klasikMax?: number[] },
) {
  const [job] = await db.insert(jobs).values({
    userId,
    title: input.title.trim().slice(0, 120),
    mode: input.mode,
    klasikMax: input.klasikMax ?? [],
  }).returning({ id: jobs.id });
  return job;
}

export async function getOwnedJob(db: Db, jobId: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return null;
  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)));
  return job ?? null;
}

export class JobLockedError extends Error {}

// The job row is locked for the whole insert, and submitJob locks the same
// row: a photo can never slip in after submission uncharged and unqueued.
export async function addPage(
  db: Db,
  storage: Storage,
  input: { jobId: string; kind: 'key' | 'student'; image: Buffer },
) {
  const filePath = `jobs/${input.jobId}/${crypto.randomUUID()}.jpg`;
  await storage.write(filePath, input.image);
  try {
    const { row, oldFiles } = await db.transaction(async (tx) => {
      const [job] = await tx.select({ status: jobs.status }).from(jobs)
        .where(eq(jobs.id, input.jobId)).for('update');
      if (job?.status !== 'draft') throw new JobLockedError('not_draft');

      let oldFiles: string[] = [];
      if (input.kind === 'key') {
        const old = await tx.delete(pages)
          .where(and(eq(pages.jobId, input.jobId), eq(pages.kind, 'key')))
          .returning({ filePath: pages.filePath });
        oldFiles = old.flatMap((o) => (o.filePath ? [o.filePath] : []));
      }
      const [{ top }] = await tx.select({ top: max(pages.seq) }).from(pages)
        .where(and(eq(pages.jobId, input.jobId), eq(pages.kind, input.kind)));
      const [row] = await tx.insert(pages).values({
        jobId: input.jobId, kind: input.kind, seq: (top ?? 0) + 1, filePath,
      }).returning({ id: pages.id, seq: pages.seq });
      return { row, oldFiles };
    });
    for (const f of oldFiles) await storage.remove(f);
    return row;
  } catch (e) {
    await storage.remove(filePath);
    throw e;
  }
}

// Only pages that were never submitted can be removed; queued pages are paid for.
export async function removePage(db: Db, storage: Storage, jobId: string, pageId: string) {
  const [row] = await db.delete(pages)
    .where(and(eq(pages.id, pageId), eq(pages.jobId, jobId), eq(pages.status, 'uploaded')))
    .returning({ filePath: pages.filePath });
  if (!row) return false;
  if (row.filePath) await storage.remove(row.filePath);
  return true;
}
