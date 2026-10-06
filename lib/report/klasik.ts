import type { jobs, pages } from '@/db/schema';
import { looksLikeName, matchRoster } from '@/lib/grading/names';
import { scoreBuckets } from '@/lib/grading/stats';
import { mergeSheets, type Sheet } from '@/lib/klasik/sheets';
import { FLAG_TEXT, attentionFlags, questionMax, scoreSheet } from '@/lib/klasik/score';
import type { Rubric } from '@/lib/types';
import { failReason, flagDuplicateNames } from './common';
import type { ReportInput, ReportRow } from './input';

type Job = typeof jobs.$inferSelect;
type PageRow = typeof pages.$inferSelect;

// Who wrote the sheet, and whether the teacher should look at the name. Same
// rules as the optik report: the teacher's name wins, then the roster match.
export function sheetStudent(sheet: Sheet, roster: string[]): { student: string | null; flags: string[] } {
  if (sheet.override.studentName) return { student: sheet.override.studentName, flags: [] };
  const read = sheet.read;
  const matched = roster.length ? matchRoster(read.studentName, roster) : null;
  const flags: string[] = [];
  if (!read.studentName) flags.push('İsim okunamadı');
  else if (roster.length && !matched) flags.push('İsim sınıf listesinde yok');
  else if (!roster.length && (read.nameConfidence === 'low' || !looksLikeName(read.studentName))) flags.push('İsim net okunamadı');
  return { student: matched ?? read.studentName, flags };
}

export const rubricOf = (job: Job): Rubric => job.rubric ?? { questions: [] };

export function buildKlasikInput(job: Job, all: PageRow[]): ReportInput {
  const rubric = rubricOf(job);
  const { sheets, failed } = mergeSheets(all.filter((p) => p.kind === 'student'));
  const rows: ReportRow[] = sheets.map((s) => {
    const sc = scoreSheet(rubric, s);
    const who = sheetStudent(s, job.roster);
    return {
      pageId: s.pageId, seq: s.seqs[0], student: who.student ?? `Kâğıt ${s.seqs[0]}`,
      correct: 0, wrong: 0, blank: 0, score: sc.percent,
      flags: [...who.flags, ...sc.questions.flatMap((q) => attentionFlags(q).map((f) => `${q.q}. soru: ${FLAG_TEXT[f]}`))],
      points: sc.questions.map((q) => ({ q: q.q, points: q.points, max: q.max })),
      total: sc.total, max: sc.max,
    };
  });
  flagDuplicateNames(rows);

  const questions = rubric.questions.map((rq) => {
    const max = questionMax(rq);
    const pts = rows.map((r) => r.points?.find((p) => p.q === rq.q)?.points ?? 0);
    const average = pts.length ? Math.round((pts.reduce((a, b) => a + b, 0) / pts.length) * 10) / 10 : 0;
    return { q: rq.q, max, average, fullCount: pts.filter((p) => p >= max).length };
  });
  const percents = rows.map((r) => r.score);
  const n = rows.length;
  return {
    mode: 'klasik',
    title: job.title || 'Sınav',
    key: { questionCount: rubric.questions.length, answers: [] },
    keyPageId: null,
    keyFlags: [],
    rows,
    failed: failed.map((p) => ({ seq: p.seq, reason: failReason(p.error) })),
    stats: {
      count: n,
      average: n ? Math.round((percents.reduce((a, b) => a + b, 0) / n) * 10) / 10 : 0,
      max: n ? Math.max(...percents) : 0,
      min: n ? Math.min(...percents) : 0,
      buckets: scoreBuckets(percents),
      questions: questions.map((x) => ({ q: x.q, correctRate: x.max ? Math.round((x.average / x.max) * 100) : 0, commonWrong: null })),
    },
    // klasik points are suggestions until the teacher approves them
    needsReview: true,
    klasik: { questions },
  };
}
