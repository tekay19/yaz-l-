import { describe, expect, it } from 'vitest';
import { fakeReader, usage } from '../helpers/reader';
import { DEMO_RUBRIC, expectedFor } from '@/lib/demo/exam';
import { gradeDemoSheets } from '@/lib/demo/grade';
import type { KlasikRead, RubricQuestion } from '@/lib/types';

const ln = (...t: string[]) => t.map((text) => ({ text, crossed: false }));
const page = (over: Partial<KlasikRead>): KlasikRead => ({
  isBackSide: false, studentName: null, nameConfidence: 'high', unreadable: false, answers: [], ...over,
});
// Elif's paper (s01): every answer right
const front = page({ studentName: 'Elif Yıldız', answers: [
  { q: 1, lines: ln('3x - 5 = 16', '3x = 16 + 5', '3x = 21', 'x = 21 / 3', 'x = 7'), unclear: false, hasFigure: false },
] });
const back = page({ isBackSide: true, answers: [
  { q: 4, lines: ln('Mitokondri'), unclear: false, hasFigure: false },
] });

// grades every criterion met, quoting the answer's last line
const allMet = (calls: number[][] = []) => fakeReader({
  gradeKlasik: async ({ questions, answers }) => {
    calls.push(questions.map((q: RubricQuestion) => q.q));
    return { usage, read: { questions: questions.map((rq: RubricQuestion) => ({
      q: rq.q,
      criteria: rq.criteria.map((c) => ({ id: c.id, verdict: 'met' as const, evidence: answers.find((a) => a.q === rq.q)!.lines.at(-1)!.text, slipOnly: false })),
      resultCorrect: rq.type === 'yorum' ? null : true, resultPath: rq.type === 'yorum' ? null : 'valid' as const,
      firstError: null, errorKind: null, flags: [], confidence: 'high' as const, note: 'Doğru.',
    })) } };
  },
});

describe('demo grading', () => {
  it('joins front and back, grades only answered questions and scores them with the product code', async () => {
    const calls: number[][] = [];
    const [s] = await gradeDemoSheets(allMet(calls), DEMO_RUBRIC, [front, back]);
    expect(calls).toEqual([[1, 4]]);
    expect(s.student).toBe('Elif Yıldız');
    expect(s.pages).toBe(2);
    expect(s.questions.find((q) => q.q === 1)!.points).toBe(20);
    expect(s.questions.find((q) => q.q === 4)!.points).toBe(10);
    expect(s.questions.find((q) => q.q === 2)!.status).toBe('missing');
    expect(s.total).toBe(30);
    expect(s.max).toBe(100);
    expect(s.expected).toMatchObject({ sheet: 's01', total: 100 });
  });

  it('gives nothing for a quote that is not on the paper', async () => {
    const lying = fakeReader({
      gradeKlasik: async ({ questions }) => ({ usage, read: { questions: questions.map((rq: RubricQuestion) => ({
        q: rq.q, criteria: rq.criteria.map((c) => ({ id: c.id, verdict: 'met' as const, evidence: 'x = 9', slipOnly: false })),
        resultCorrect: true, resultPath: 'valid' as const, firstError: null, errorKind: null, flags: [], confidence: 'high' as const, note: '',
      })) } }),
    });
    const [s] = await gradeDemoSheets(lying, DEMO_RUBRIC, [front]);
    const q1 = s.questions.find((q) => q.q === 1)!;
    expect(q1.points).toBe(0);
    expect(q1.attention.length).toBeGreaterThan(0);
  });

  it('knows the expected points of the example students only', () => {
    expect(expectedFor('MERT KAYA')?.total).toBe(100);
    expect(expectedFor('Zeynep Arslan')?.total).toBe(30);
    expect(expectedFor('Başka Biri')).toBeNull();
    expect(expectedFor(null)).toBeNull();
  });
});
