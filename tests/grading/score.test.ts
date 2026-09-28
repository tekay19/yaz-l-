import { describe, expect, it } from 'vitest';
import { scoreSheet } from '@/lib/grading/score';
import type { KeyRead } from '@/lib/types';

const key: KeyRead = { questionCount: 4, answers: [
  { q: 1, option: 'A' }, { q: 2, option: 'B' }, { q: 3, option: 'C' }, { q: 4, option: null },
] };

describe('scoreSheet', () => {
  it('counts correct, wrong, blank and scores over keyed questions only', () => {
    const s = scoreSheet(key, [
      { q: 1, marked: ['A'] }, { q: 2, marked: ['C'] }, { q: 3, marked: [] }, { q: 4, marked: ['D'] },
    ]);
    expect([s.correct, s.wrong, s.blank]).toEqual([1, 1, 1]);
    expect(s.score).toBe(33); // 1 of 3 keyed questions
    expect(s.questions.find((q) => q.q === 4)!.outcome).toBe('nokey');
  });
  it('treats two marks as wrong and flags the question', () => {
    const s = scoreSheet(key, [{ q: 1, marked: ['A', 'B'] }]);
    expect(s.questions[0].outcome).toBe('multi');
    expect(s.wrong).toBe(1);
    expect(s.flags).toContain('1. soruda birden fazla işaret');
  });
  it('flags low-confidence reads and missing questions', () => {
    const s = scoreSheet(key, [{ q: 1, marked: ['A'], confidence: 'low' }]);
    expect(s.flags).toContain('1. soru net okunamadı');
    expect(s.blank).toBe(2); // q2 and q3 absent → blank
    // ...but never silently: a cut-off photo must reach the teacher
    expect(s.flags).toContain('Kâğıtta bulunamayan sorular: 2, 3');
  });
  it('scores 0 when nothing is keyed', () => {
    expect(scoreSheet({ questionCount: 1, answers: [{ q: 1, option: null }] }, []).score).toBe(0);
  });
});
