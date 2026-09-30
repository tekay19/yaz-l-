// The klasik grading gate (eval/README.md, "Klasik"). A suggestion that is
// flagged costs the teacher a look; one that is wrong and NOT flagged costs a
// student a fair grade. Both directions are measured on their own:
//   silentUnder — the teacher gave more (a correct but different answer lost points)
//   silentOver  — the teacher gave less (a wrong path or a bare result earned points)

import type { KlasikAnswer, Rubric } from '@/lib/types';
import { INFO_FLAGS, type ScoreFlag } from '@/lib/klasik/score';

export type KlasikCase = {
  id: string; q: number; tags: string[]; teacher: number;
  lines: (string | { text: string; crossed: boolean })[];
  hasFigure?: boolean;
};
export type KlasikSet = { title: string; rubric: Rubric; cases: KlasikCase[] };
export type KlasikResult = {
  id: string; q: number; tags: string[]; teacher: number; suggested: number; max: number;
  flags: ScoreFlag[]; tokensIn: number; tokensOut: number; ms: number;
};

// A miss is a gap of more than this share of the question's maximum.
export const TOLERANCE = 0.1;

export const asAnswer = (c: KlasikCase): KlasikAnswer => ({
  q: c.q,
  lines: c.lines.map((l) => (typeof l === 'string' ? { text: l, crossed: false } : l)),
  unclear: false,
  hasFigure: c.hasFigure ?? false,
});

const round1 = (n: number) => Math.round(n * 10) / 10;
const flagged = (r: KlasikResult) => r.flags.some((f) => !INFO_FLAGS.has(f));

export function klasikSummary(results: KlasikResult[]) {
  const n = results.length;
  const dev = (r: KlasikResult) => (r.max ? (Math.abs(r.suggested - r.teacher) / r.max) * 100 : 0);
  const miss = (r: KlasikResult) => TOLERANCE * r.max;
  const under = results.filter((r) => !flagged(r) && r.teacher - r.suggested > miss(r));
  const over = results.filter((r) => !flagged(r) && r.suggested - r.teacher > miss(r));
  const pct = (k: number) => (n ? round1((k / n) * 100) : null);
  const tags = [...new Set(results.flatMap((r) => r.tags))].sort();
  return {
    cases: n,
    avgDeviationPct: n ? round1(results.reduce((s, r) => s + dev(r), 0) / n) : null,
    silentUnderRate: pct(under.length),
    silentOverRate: pct(over.length),
    flaggedRate: pct(results.filter(flagged).length),
    silentUnder: under.map((r) => r.id),
    silentOver: over.map((r) => r.id),
    byTag: Object.fromEntries(tags.map((t) => {
      const rs = results.filter((r) => r.tags.includes(t));
      return [t, { n: rs.length, avgDeviationPct: round1(rs.reduce((s, r) => s + dev(r), 0) / rs.length) }];
    })),
  };
}
export type KlasikSummary = ReturnType<typeof klasikSummary>;

export type KlasikCheck = { key: string; label: string; value: number | null; limit: string; pass: boolean | null };

export function klasikCriteria(s: KlasikSummary): KlasikCheck[] {
  const judge = (v: number | null, ok: (v: number) => boolean) => (v === null ? null : ok(v));
  return [
    { key: 'avgDeviationPct', label: 'Öğretmene göre ortalama sapma (%)', value: s.avgDeviationPct, limit: '≤ 10', pass: judge(s.avgDeviationPct, (v) => v <= 10) },
    { key: 'silentUnderRate', label: 'Sessiz eksik puan (%)', value: s.silentUnderRate, limit: '≤ 2', pass: judge(s.silentUnderRate, (v) => v <= 2) },
    { key: 'silentOverRate', label: 'Sessiz fazla puan (%)', value: s.silentOverRate, limit: '≤ 2', pass: judge(s.silentOverRate, (v) => v <= 2) },
  ];
}
