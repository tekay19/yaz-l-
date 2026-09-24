import { asc, eq } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { jobs, pages } from '@/db/schema';
import type { KeyRead, Option } from '@/lib/types';
import { scoreSheet } from '@/lib/grading/score';
import { classStats, type ClassStats } from '@/lib/grading/stats';
import { matchRoster } from '@/lib/grading/names';

export type ReportRow = {
  pageId: string; seq: number; student: string;
  correct: number; wrong: number; blank: number; score: number; flags: string[];
};
export type ReportInput = {
  title: string; key: KeyRead; rows: ReportRow[];
  failed: { seq: number; reason: string }[];
  stats: ClassStats; needsReview: boolean;
};

const REASONS: Record<string, string> = {
  unreadable: 'Fotoğraf okunamadı', refused: 'Fotoğraf işlenemedi', max_attempts: 'Okuma zaman aşımına uğradı',
};

export async function buildReportInput(db: Db, jobId: string): Promise<ReportInput> {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  // 'uploaded' pages were never submitted or charged; they are not part of the exam
  const all = (await db.select().from(pages).where(eq(pages.jobId, jobId)).orderBy(asc(pages.seq)))
    .filter((p) => p.status !== 'uploaded');
  const keyPage = all.find((p) => p.kind === 'key');
  if (keyPage?.result?.type !== 'key') throw new Error('key_not_read');
  const key = keyPage.result.read;

  const rows: ReportRow[] = [];
  const failed: ReportInput['failed'] = [];
  const sheets = [];
  for (const p of all.filter((x) => x.kind === 'student')) {
    if (p.status !== 'read' || p.result?.type !== 'student') {
      failed.push({ seq: p.seq, reason: REASONS[p.error ?? ''] ?? 'Fotoğraf okunamadı' });
      continue;
    }
    const read = p.result.read;
    const ov = p.override ?? {};
    const answers = read.answers.map((a) => {
      const fixed = ov.answers?.find((o) => o.q === a.q);
      return fixed ? { q: a.q, marked: fixed.marked as Option[], confidence: 'high' as const } : a;
    });
    const s = scoreSheet(key, answers);
    const flags = [...s.flags];

    let student = ov.studentName ?? null;
    if (!student) {
      const matched = job.roster.length ? matchRoster(read.studentName, job.roster) : null;
      student = matched ?? read.studentName;
      if (!read.studentName) flags.unshift('İsim okunamadı');
      else if (job.roster.length && !matched) flags.unshift('İsim sınıf listesinde yok');
      else if (!job.roster.length && read.nameConfidence === 'low') flags.unshift('İsim net okunamadı');
    }
    if (ov.answers?.length) {
      // corrected questions are no longer "unsure"
      const fixedQs = new Set(ov.answers.map((o) => o.q));
      for (let i = flags.length - 1; i >= 0; i--) {
        const q = Number(flags[i].split('.')[0]);
        if (fixedQs.has(q)) flags.splice(i, 1);
      }
    }
    sheets.push(s);
    rows.push({
      pageId: p.id, seq: p.seq, student: student ?? `Kâğıt ${p.seq}`,
      correct: s.correct, wrong: s.wrong, blank: s.blank, score: s.score, flags,
    });
  }
  return {
    title: job.title || 'Sınav', key, rows, failed,
    stats: classStats(key, sheets),
    needsReview: rows.some((r) => r.flags.length > 0),
  };
}
