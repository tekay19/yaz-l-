import { desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { jobs, pages } from '@/db/schema';

export type JobStatusView = {
  id: string; title: string; mode: 'optik' | 'klasik'; status: string;
  pages: { key: number; students: number; read: number; failed: number };
  createdAt: string;
};

async function views(db: Db, rows: (typeof jobs.$inferSelect)[]): Promise<JobStatusView[]> {
  if (!rows.length) return [];
  const all = await db.select({ jobId: pages.jobId, kind: pages.kind, status: pages.status })
    .from(pages).where(inArray(pages.jobId, rows.map((r) => r.id)));
  return rows.map((j) => {
    const mine = all.filter((p) => p.jobId === j.id);
    const students = mine.filter((p) => p.kind === 'student');
    return {
      id: j.id, title: j.title, mode: j.mode, status: j.status, createdAt: j.createdAt.toISOString(),
      pages: {
        key: mine.length - students.length,
        students: students.length,
        read: students.filter((p) => p.status === 'read').length,
        failed: students.filter((p) => p.status === 'failed').length,
      },
    };
  });
}

export async function jobStatus(db: Db, jobId: string) {
  return (await views(db, await db.select().from(jobs).where(eq(jobs.id, jobId))))[0];
}

export async function listJobs(db: Db, userId: string) {
  return views(db, await db.select().from(jobs).where(eq(jobs.userId, userId)).orderBy(desc(jobs.createdAt)).limit(50));
}
