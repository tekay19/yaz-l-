import { describe, expect, it } from 'vitest';
import { scoreSheet } from '@/lib/grading/score';
import { classStats } from '@/lib/grading/stats';
import type { KeyRead } from '@/lib/types';

const key: KeyRead = { questionCount: 2, answers: [{ q: 1, option: 'A' }, { q: 2, option: 'B' }] };

describe('classStats', () => {
  it('computes average, extremes, buckets and hardest question', () => {
    const sheets = [
      scoreSheet(key, [{ q: 1, marked: ['A'] }, { q: 2, marked: ['B'] }]), // 100
      scoreSheet(key, [{ q: 1, marked: ['A'] }, { q: 2, marked: ['C'] }]), // 50
      scoreSheet(key, [{ q: 1, marked: ['D'] }, { q: 2, marked: ['C'] }]), // 0
    ];
    const s = classStats(key, sheets);
    expect(s.average).toBe(50);
    expect([s.max, s.min]).toEqual([100, 0]);
    expect(s.questions.find((q) => q.q === 2)).toEqual({ q: 2, correctRate: 33, commonWrong: 'C' });
    expect(s.buckets.reduce((n, b) => n + b.count, 0)).toBe(3);
  });
  it('handles an empty class', () => {
    expect(classStats(key, []).average).toBe(0);
  });
});
