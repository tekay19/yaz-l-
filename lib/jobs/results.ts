import type { Db } from '@/db/client';
import type { jobs } from '@/db/schema';
import { buildReportInput } from '@/lib/report/input';
import { HttpError } from '@/lib/http';

// An exam's results once it is read: what the teacher sees on the results
// tab and downloads, the same numbers the e-mailed report carries.
export const RESULT_STATUSES = new Set(['review', 'delivering', 'done']);

export type ExamResults = {
  mode: 'optik' | 'klasik'; title: string; final: boolean;
  stats: { count: number; average: number; max: number; min: number; buckets: { label: string; count: number }[] };
  rows: { pageId: string; student: string; score: number; total: number | null; max: number | null;
    correct: number; wrong: number; blank: number; points: { q: number; points: number; max: number }[] | null; flags: number }[];
  questions: { q: number; average: number; max: number; rate: number }[];
  failed: { seq: number; reason: string }[];
};

type Job = typeof jobs.$inferSelect;

export async function examResults(db: Db, job: Job): Promise<ExamResults> {
  if (!RESULT_STATUSES.has(job.status)) throw new HttpError(409, 'Sonuçlar, kâğıtlar okunduktan sonra görünür.');
  const input = await buildReportInput(db, job.id);
  const questions = input.klasik
    ? input.klasik.questions.map((q) => ({ q: q.q, average: q.average, max: q.max, rate: q.max ? q.average / q.max : 0 }))
    // optik: the share of the class that got it right (correctRate is a percentage)
    : input.stats.questions.map((q) => ({ q: q.q, average: q.correctRate, max: 100, rate: q.correctRate / 100 }));
  return {
    mode: input.mode, title: input.title, final: job.status !== 'review',
    stats: { count: input.stats.count, average: input.stats.average, max: input.stats.max, min: input.stats.min, buckets: input.stats.buckets },
    rows: input.rows.map((r) => ({
      pageId: r.pageId, student: r.student, score: r.score, total: r.total, max: r.max,
      correct: r.correct, wrong: r.wrong, blank: r.blank, points: r.points, flags: r.flags.length,
    })).sort((a, b) => a.student.localeCompare(b.student, 'tr')),
    questions,
    failed: input.failed,
  };
}
