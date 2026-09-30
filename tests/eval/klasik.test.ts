import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { RubricInput } from '@/lib/klasik/rubric';
import { scoreQuestion } from '@/lib/klasik/score';
import { asAnswer, klasikCriteria, klasikSummary, type KlasikResult, type KlasikSet } from '@/lib/eval/klasik-metrics';

const r = (over: Partial<KlasikResult>): KlasikResult => ({
  id: 'x', q: 1, tags: ['dogru'], teacher: 10, suggested: 10, max: 10, flags: [], tokensIn: 0, tokensOut: 0, ms: 0, ...over,
});

describe('klasik metrics', () => {
  it('tells silent misses in both directions from flagged ones', () => {
    const s = klasikSummary([
      r({ id: 'ok' }),
      r({ id: 'under', tags: ['farkli-dogru'], suggested: 6 }), // a correct different path lost points, unflagged
      r({ id: 'under-info', tags: ['farkli-dogru'], suggested: 6, flags: ['alternative_path'] }), // an info flag does not make it visible
      r({ id: 'over', tags: ['yanlis-yol'], teacher: 0, suggested: 7 }),
      r({ id: 'flagged', tags: ['yanlis-yol'], teacher: 0, suggested: 7, flags: ['invalid_path'] }),
      r({ id: 'close', suggested: 9.5 }), // within the tolerance
    ]);
    expect(s.silentUnder).toEqual(['under', 'under-info']);
    expect(s.silentOver).toEqual(['over']);
    expect(s).toMatchObject({ cases: 6, silentUnderRate: 33.3, silentOverRate: 16.7, flaggedRate: 16.7, avgDeviationPct: 37.5 });
    expect(s.byTag['yanlis-yol']).toEqual({ n: 2, avgDeviationPct: 70 });
    expect(klasikCriteria(s).map((c) => c.pass)).toEqual([false, false, false]);
    expect(klasikCriteria(klasikSummary([])).map((c) => c.pass)).toEqual([null, null, null]);
  });
});

// The measurement set is part of the product: a broken case would quietly
// skew the gate, so its shape is checked with every test run.
describe('eval/klasik/cases.json', () => {
  const set = JSON.parse(fs.readFileSync('eval/klasik/cases.json', 'utf8')) as KlasikSet;

  it('has a rubric the editor would accept, and every case fits it', () => {
    expect(RubricInput.safeParse(set.rubric).success).toBe(true);
    expect(new Set(set.cases.map((c) => c.id)).size).toBe(set.cases.length);
    for (const c of set.cases) {
      const rq = set.rubric.questions.find((q) => q.q === c.q);
      expect(rq, c.id).toBeDefined();
      const max = rq!.criteria.reduce((s, x) => s + x.points, 0);
      expect(c.teacher, c.id).toBeGreaterThanOrEqual(0);
      expect(c.teacher, c.id).toBeLessThanOrEqual(max);
      expect(c.tags.length, c.id).toBeGreaterThan(0);
      expect(asAnswer(c).lines.length, c.id).toBeGreaterThan(0);
    }
  });

  it('covers every case the product owner asked about', () => {
    const tags = new Set(set.cases.flatMap((c) => c.tags));
    for (const t of ['farkli-dogru', 'yanlis-yol', 'desteksiz', 'iki-hata', 'hata-tasima', 'benzer-yanlis', 'kavram-sayma', 'gerekce', 'enjeksiyon', 'ustu-cizili']) {
      expect(tags.has(t), t).toBe(true);
    }
  });

  // With no model involved, a bare "x = 4" to a question that asks for the
  // work scores 0 whatever the verdicts say: the rule lives in code.
  it('scores the bare result of a work-required question 0 by code alone', () => {
    const c = set.cases.find((x) => x.id === 'q1-islemsiz')!;
    const rq = set.rubric.questions.find((q) => q.q === c.q)!;
    const s = scoreQuestion(rq, asAnswer(c), {
      q: 1, rev: 1, criteria: rq.criteria.map((x) => ({ id: x.id, verdict: 'met', evidence: 'x = 4' })),
      resultCorrect: true, resultPath: 'none', firstError: null, errorKind: null, flags: [], confidence: 'high', note: '', failed: false, textOnly: false,
    });
    expect(s.points).toBe(c.teacher);
  });
});
