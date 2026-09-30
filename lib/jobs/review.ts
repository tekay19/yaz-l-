import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '@/db/client';
import { jobs, pages } from '@/db/schema';
import { OPTIONS, type Option, type PageOverride } from '@/lib/types';

const OptionZ = z.enum(OPTIONS as [Option, ...Option[]]);
const Q = z.number().int().min(1).max(200);

// What the optik review screen may send. A body that does not match is a 400,
// not a crash deep inside the save.
export const OptikPatch = z.object({
  studentName: z.string().trim().min(1).max(80).optional(),
  answers: z.array(z.object({ q: Q, marked: z.array(OptionZ).max(5) })).max(200).optional(),
  key: z.array(z.object({ q: Q, option: OptionZ.nullable() })).max(200).optional(),
});
export type OptikPatchInput = z.infer<typeof OptikPatch>;

export async function setRoster(db: Db, jobId: string, lines: string): Promise<number> {
  const roster = [...new Set(lines.split(/\r?\n/).map((l) => l.trim().slice(0, 80)).filter(Boolean))].slice(0, 200);
  await db.update(jobs).set({ roster }).where(eq(jobs.id, jobId));
  return roster.length;
}

export async function savePageOverride(db: Db, jobId: string, pageId: string, patch: PageOverride): Promise<boolean> {
  if (patch.answers?.some((a) => !Number.isInteger(a.q) || !Array.isArray(a.marked)
    || a.marked.some((m) => !OPTIONS.includes(m as Option)))) return false;
  if (patch.studentName !== undefined && !patch.studentName.trim()) return false;
  const [page] = await db.select({ override: pages.override }).from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.jobId, jobId), eq(pages.kind, 'student')));
  if (!page) return false;
  const prev = page.override ?? {};
  const answers = new Map((prev.answers ?? []).map((a) => [a.q, a]));
  for (const a of patch.answers ?? []) answers.set(a.q, a);
  await db.update(pages).set({
    override: {
      ...prev,
      studentName: patch.studentName?.trim() ?? prev.studentName,
      answers: [...answers.values()],
    },
  }).where(eq(pages.id, pageId));
  return true;
}

// The teacher's fix of the answer key: sets a question the reader missed or
// misread, or confirms (null) that the question has no key and counts for nobody.
export async function saveKeyOverride(
  db: Db, jobId: string, pageId: string, fixes: { q: number; option: Option | null }[],
): Promise<boolean> {
  const [page] = await db.select({ override: pages.override }).from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.jobId, jobId), eq(pages.kind, 'key')));
  if (!page) return false;
  const prev = page.override ?? {};
  const key = new Map((prev.key ?? []).map((k) => [k.q, k]));
  for (const f of fixes) key.set(f.q, f);
  await db.update(pages).set({ override: { ...prev, key: [...key.values()] } }).where(eq(pages.id, pageId));
  return true;
}

export async function approveJob(db: Db, jobId: string): Promise<boolean> {
  const moved = await db.update(jobs).set({ status: 'delivering' })
    .where(and(eq(jobs.id, jobId), eq(jobs.status, 'review')))
    .returning({ id: jobs.id });
  return moved.length > 0;
}
