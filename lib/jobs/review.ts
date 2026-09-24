import { and, eq } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { jobs, pages } from '@/db/schema';
import { OPTIONS, type Option, type PageOverride } from '@/lib/types';

export async function setRoster(db: Db, jobId: string, lines: string): Promise<number> {
  const roster = [...new Set(lines.split(/\r?\n/).map((l) => l.trim().slice(0, 80)).filter(Boolean))].slice(0, 200);
  await db.update(jobs).set({ roster }).where(eq(jobs.id, jobId));
  return roster.length;
}

export async function savePageOverride(db: Db, jobId: string, pageId: string, patch: PageOverride): Promise<boolean> {
  if (patch.answers?.some((a) => !Number.isInteger(a.q) || a.marked.some((m) => !OPTIONS.includes(m as Option)))) return false;
  if (patch.studentName !== undefined && !patch.studentName.trim()) return false;
  const [page] = await db.select({ override: pages.override }).from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.jobId, jobId), eq(pages.kind, 'student')));
  if (!page) return false;
  const prev = page.override ?? {};
  const answers = new Map((prev.answers ?? []).map((a) => [a.q, a]));
  for (const a of patch.answers ?? []) answers.set(a.q, a);
  await db.update(pages).set({
    override: {
      studentName: patch.studentName?.trim() ?? prev.studentName,
      answers: [...answers.values()],
      points: patch.points ?? prev.points,
    },
  }).where(eq(pages.id, pageId));
  return true;
}

export async function approveJob(db: Db, jobId: string): Promise<boolean> {
  const moved = await db.update(jobs).set({ status: 'delivering' })
    .where(and(eq(jobs.id, jobId), eq(jobs.status, 'review')))
    .returning({ id: jobs.id });
  return moved.length > 0;
}
