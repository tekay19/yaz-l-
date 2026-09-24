import type { KeyRead, Option } from '@/lib/types';
import type { SheetScore } from './score';

export type ClassStats = {
  count: number; average: number; max: number; min: number;
  buckets: { label: string; count: number }[];
  questions: { q: number; correctRate: number; commonWrong: Option | null }[];
};

const BUCKETS = [
  { label: '0–49', lo: 0, hi: 49 }, { label: '50–69', lo: 50, hi: 69 },
  { label: '70–84', lo: 70, hi: 84 }, { label: '85–100', lo: 85, hi: 100 },
];

// Shared with the klasik report, which has scores but no option key.
export function scoreBuckets(scores: number[]): ClassStats['buckets'] {
  return BUCKETS.map((b) => ({ label: b.label, count: scores.filter((s) => s >= b.lo && s <= b.hi).length }));
}

export function classStats(key: KeyRead, sheets: SheetScore[]): ClassStats {
  const scores = sheets.map((s) => s.score);
  const n = sheets.length;
  const questions = key.answers.filter((k) => k.option !== null).map((k) => {
    let right = 0;
    const wrongs = new Map<Option, number>();
    for (const s of sheets) {
      const q = s.questions.find((x) => x.q === k.q);
      if (q?.outcome === 'correct') right++;
      if (q?.outcome === 'wrong') wrongs.set(q.marked[0], (wrongs.get(q.marked[0]) ?? 0) + 1);
    }
    const common = [...wrongs].sort((a, b) => b[1] - a[1])[0];
    return { q: k.q, correctRate: n ? Math.round((right / n) * 100) : 0, commonWrong: common ? common[0] : null };
  });
  return {
    count: n,
    average: n ? Math.round((scores.reduce((a, b) => a + b, 0) / n) * 10) / 10 : 0,
    max: n ? Math.max(...scores) : 0,
    min: n ? Math.min(...scores) : 0,
    buckets: scoreBuckets(scores),
    questions,
  };
}
