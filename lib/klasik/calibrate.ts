import type { Rubric } from '@/lib/types';
import { answerText, type Sheet } from './sheets';
import { questionMax, scoreQuestion, scoreSheet } from './score';
import { isChoice } from './rubric';

// The first sheets the teacher checks, so the system can learn how they mark
// before the rest of the class is graded again. The ones that answer the most
// questions (each checked answer is an example for its question), spread over
// low, middle and high totals: a generous or a strict marker shows on all of
// them. The totals are the system's own suggestions, so the sheets stay put
// while the teacher checks them: their points would otherwise reorder the
// class after the first sheet, and swap a sheet half corrected for another.
export const CALIBRATION_SHEETS = 3;

export function pickCalibration(rubric: Rubric, sheets: Sheet[], n = CALIBRATION_SHEETS): string[] {
  const answered = (s: Sheet) => rubric.questions.filter((rq) => answerText(s.read.answers.find((a) => a.q === rq.q)).trim()).length;
  const pool = sheets
    .map((s) => ({ s, answered: answered(s) }))
    .filter((x) => x.answered > 0)
    .sort((a, b) => b.answered - a.answered || a.s.seqs[0] - b.s.seqs[0])
    .slice(0, Math.max(n * 3, 9))
    .map((x) => ({ ...x, percent: scoreSheet(rubric, { ...x.s, override: { ...x.s.override, points: [] } }).percent }))
    .sort((a, b) => a.percent - b.percent || a.s.seqs[0] - b.s.seqs[0]);
  if (pool.length <= n) return pool.map((x) => x.s.pageId);
  // evenly over the totals, lowest to highest
  const picked = new Set<string>();
  for (let i = 0; i < n; i++) picked.add(pool[Math.round((i * (pool.length - 1)) / (n - 1))].s.pageId);
  for (const x of pool) if (picked.size < n) picked.add(x.s.pageId);
  return [...picked];
}

// After the first sheets, once the class is graded their way: a question the
// teacher never gave full marks on has no example of what earns them, and a
// strict key stays strict there (measured 2026-10-12: the four such questions
// of fifteen carried 37% of the gap left). For each, the answers the system
// scored highest among the sheets the teacher has not scored — the ones most
// likely to deserve full marks — so one look settles the question either way.
// Test questions have nothing to settle.
export const BEST_ANSWERS = 2;
export type BestAnswers = { q: number; pageIds: string[] }[];

export function pickBestAnswers(rubric: Rubric, sheets: Sheet[], n = BEST_ANSWERS): BestAnswers {
  const text = (s: Sheet, q: number) => answerText(s.read.answers.find((a) => a.q === q)).trim();
  const teacher = (s: Sheet, q: number) => s.override.points?.find((p) => p.q === q)?.points;
  return rubric.questions.filter((rq) => !isChoice(rq)).flatMap((rq) => {
    const max = questionMax(rq);
    if (!max || sheets.some((s) => text(s, rq.q) && (teacher(s, rq.q) ?? -1) >= max)) return [];
    const best = sheets
      .filter((s) => text(s, rq.q) && teacher(s, rq.q) === undefined)
      .map((s) => ({ s, score: scoreQuestion(rq, s.read.answers.find((a) => a.q === rq.q), s.grade?.questions.find((g) => g.q === rq.q)) }))
      .filter((x) => x.score.status === 'graded')
      .sort((a, b) => b.score.points - a.score.points || text(b.s, rq.q).length - text(a.s, rq.q).length || a.s.seqs[0] - b.s.seqs[0])
      .slice(0, n);
    return best.length ? [{ q: rq.q, pageIds: best.map((x) => x.s.pageId) }] : [];
  });
}
