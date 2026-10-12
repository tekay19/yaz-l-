import { describe, expect, it } from 'vitest';
import { pickCalibration } from '@/lib/klasik/calibrate';
import { normalizeDraft } from '@/lib/klasik/rubric';
import type { Rubric } from '@/lib/types';

const rubric: Rubric = normalizeDraft({ questions: [1, 2].map((q) => ({
  q, type: 'islem' as const, prompt: null, answer: 'x = 4', workRequired: false, accepted: [],
  criteria: [{ text: 'Sonuç', points: 1, role: 'result' as const, required: false }],
})) }, [10, 10]);
const answer = (q: number) => ({ q, lines: [{ text: 'x = 4', crossed: false }], unclear: false, hasFigure: false });
// a sheet the system graded to a known total: the result criterion met on as
// many questions as the total has tens
const grade = (q: number, met: boolean) => ({
  q, rev: 1, criteria: [{ id: 'c1', verdict: met ? 'met' as const : 'not_met' as const, evidence: met ? 'x = 4' : '' }],
  resultCorrect: met, resultPath: 'none' as const, firstError: null, errorKind: null, flags: [], confidence: 'high' as const, note: '', failed: false, textOnly: false,
});
const sheet = (n: number, qs: number[], total: number, teacher: { q: number; points: number }[] = []) => ({
  pageId: `p${n}`, pageIds: [`p${n}`], seqs: [n], filePaths: [], gradedRev: 1, gradeAttempts: 0,
  grade: { questions: qs.map((q, i) => grade(q, total >= (i + 1) * 10)) },
  read: { isBackSide: false, studentName: `Öğrenci ${n}`, nameConfidence: 'high' as const, unreadable: false, answers: qs.map(answer) },
  override: { points: teacher },
});

describe('the first sheets to check', () => {
  it('takes the sheets that answer the most, spread from the lowest total to the highest', () => {
    const totals = [0, 0, 0, 10, 10, 10, 20, 20, 20, 20];
    const sheets = [
      ...totals.map((t, i) => sheet(i + 1, [1, 2], t)),
      sheet(11, [1], 20), sheet(12, [1], 20), // fewer answers: fewer examples
    ];
    expect(pickCalibration(rubric, sheets)).toEqual(['p1', 'p5', 'p9']);
  });

  it('keeps the same sheets while the teacher scores them', () => {
    const totals = [0, 0, 0, 10, 10, 10, 20, 20, 20, 20];
    const before = totals.map((t, i) => sheet(i + 1, [1, 2], t));
    const after = before.map((s) => (s.pageId === 'p1' ? sheet(1, [1, 2], 0, [{ q: 1, points: 10 }, { q: 2, points: 10 }]) : s));
    expect(pickCalibration(rubric, after)).toEqual(pickCalibration(rubric, before));
  });

  it('gives every answering sheet of a small class, and never an empty one', () => {
    expect(pickCalibration(rubric, [sheet(1, [1, 2], 10), sheet(2, [], 0), sheet(3, [1], 0)])).toEqual(['p3', 'p1']);
  });
});
