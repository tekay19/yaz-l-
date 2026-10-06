import { asc, eq } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { jobs, pages } from '@/db/schema';
import type { KeyRead, Option } from '@/lib/types';
import { scoreSheet } from '@/lib/grading/score';
import { classStats, type ClassStats } from '@/lib/grading/stats';
import { looksLikeName, matchRoster } from '@/lib/grading/names';
import { failReason, flagDuplicateNames } from './common';
import { buildKlasikInput } from './klasik';

export type ReportRow = {
  pageId: string; seq: number; student: string;
  correct: number; wrong: number; blank: number; score: number; flags: string[];
  // klasik only: points per rubric question and the sheet's total
  points: { q: number; points: number; max: number }[] | null;
  total: number | null; max: number | null;
};
export type ReportInput = {
  mode: 'optik' | 'klasik';
  title: string; key: KeyRead; keyPageId: string | null;
  keyFlags: string[];
  rows: ReportRow[];
  failed: { seq: number; reason: string }[];
  stats: ClassStats; needsReview: boolean;
  klasik: { questions: { q: number; max: number; average: number; fullCount: number }[] } | null;
};

// The key as the teacher confirmed it. A key answer read as blank would
// silently drop that question for the whole class, so it is flagged until the
// teacher either sets the option or confirms the question has no key (null).
export function effectiveKey(read: KeyRead, fixes: { q: number; option: Option | null }[] = []) {
  const byQ = new Map(read.answers.map((a) => [a.q, a.option]));
  for (const f of fixes) byQ.set(f.q, f.option);
  const answers = [...byQ].map(([q, option]) => ({ q, option })).sort((a, b) => a.q - b.q);
  const fixed = new Set(fixes.map((f) => f.q));
  const blank = answers.filter((a) => a.option === null && !fixed.has(a.q)).map((a) => a.q);
  const missing: number[] = [];
  for (let q = 1; q <= read.questionCount; q++) if (!byQ.has(q)) missing.push(q);
  const flags: string[] = [];
  if (blank.length) flags.push(`Anahtarda okunamayan soru: ${blank.join(', ')}`);
  if (missing.length) flags.push(`Anahtarda bulunamayan soru: ${missing.join(', ')}`);
  return { key: { questionCount: read.questionCount, answers }, flags };
}

type PageRow = typeof pages.$inferSelect;

export async function buildReportInput(db: Db, jobId: string): Promise<ReportInput> {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  // 'uploaded' pages were never submitted or charged; they are not part of the exam
  const all = (await db.select().from(pages).where(eq(pages.jobId, jobId)).orderBy(asc(pages.seq)))
    .filter((p) => p.status !== 'uploaded');
  if (job.mode === 'klasik') return buildKlasikInput(job, all);
  return buildOptikInput(job, all);
}

function buildOptikInput(job: typeof jobs.$inferSelect, all: PageRow[]): ReportInput {
  const keyPage = all.find((p) => p.kind === 'key');
  if (keyPage?.result?.type !== 'key') throw new Error('key_not_read');
  const { key, flags: keyFlags } = effectiveKey(keyPage.result.read, keyPage.override?.key);

  const rows: ReportRow[] = [];
  const failed: ReportInput['failed'] = [];
  const sheets = [];

  // A back-side photo carries no name; its answers belong to the sheet
  // photographed just before it (teachers shoot front, flip, shoot back).
  const merged: PageRow[] = [];
  for (const p of all.filter((x) => x.kind === 'student')) {
    const prev = merged[merged.length - 1];
    if (p.result?.type === 'student' && p.result.read.isBackSide && prev?.result?.type === 'student') {
      const seen = new Set(prev.result.read.answers.map((a) => a.q));
      prev.result = {
        type: 'student',
        read: { ...prev.result.read, answers: [...prev.result.read.answers, ...p.result.read.answers.filter((a) => !seen.has(a.q))] },
      };
      continue;
    }
    merged.push({ ...p });
  }

  for (const p of merged) {
    if (p.status !== 'read' || p.result?.type !== 'student') {
      failed.push({ seq: p.seq, reason: failReason(p.error) });
      continue;
    }
    const read = p.result.read;
    const ov = p.override ?? {};
    const fixes = new Map((ov.answers ?? []).map((o) => [o.q, o]));
    const answers = read.answers.map((a) => {
      const fixed = fixes.get(a.q);
      return fixed ? { q: a.q, marked: fixed.marked as Option[], confidence: 'high' as const } : a;
    });
    // a question the reader missed entirely can still be entered by the teacher
    for (const o of ov.answers ?? []) {
      if (!read.answers.some((a) => a.q === o.q)) answers.push({ q: o.q, marked: o.marked, confidence: 'high' });
    }
    const s = scoreSheet(key, answers);
    const flags = [...s.flags];

    let student = ov.studentName ?? null;
    if (!student) {
      const matched = job.roster.length ? matchRoster(read.studentName, job.roster) : null;
      student = matched ?? read.studentName;
      if (!read.studentName) flags.unshift('İsim okunamadı');
      else if (job.roster.length && !matched) flags.unshift('İsim sınıf listesinde yok');
      else if (!job.roster.length && (read.nameConfidence === 'low' || !looksLikeName(read.studentName))) flags.unshift('İsim net okunamadı');
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
      points: null, total: null, max: null,
    });
  }
  flagDuplicateNames(rows);
  return {
    mode: 'optik', title: job.title || 'Sınav', key, keyPageId: keyPage.id, keyFlags, rows, failed,
    stats: classStats(key, sheets),
    needsReview: keyFlags.length > 0 || rows.some((r) => r.flags.length > 0),
    klasik: null,
  };
}
