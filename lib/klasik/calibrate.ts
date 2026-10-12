import type { Rubric } from '@/lib/types';
import { answerText, type Sheet } from './sheets';
import { scoreSheet } from './score';

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
