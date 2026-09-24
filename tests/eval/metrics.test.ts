import { describe, expect, it } from 'vitest';
import { addSheet, checkCriteria, checkKey, checkStudent, emptyTotals, summarize } from '@/lib/eval/metrics';

describe('checkKey', () => {
  it('counts every keyed question and records the misreads', () => {
    const r = checkKey(
      { kind: 'key', questionCount: 3, answers: [{ q: 1, option: 'A' }, { q: 2, option: 'B' }, { q: 3, option: null }] },
      { questionCount: 3, answers: [{ q: 1, option: 'A' }, { q: 2, option: 'C' }] }, // q3 missing = null = right
    );
    expect(r).toMatchObject({ questions: 3, silentWrong: 1, flagged: 0, name: null });
    expect(r.mistakes).toEqual([{ q: 2, want: 'B', got: 'C' }]);
  });
});

describe('checkStudent', () => {
  const truth = {
    kind: 'student' as const, questionCount: 4, studentName: 'Işıl Öztürk',
    answers: [{ q: 1, marked: ['A' as const] }, { q: 2, marked: ['A' as const, 'B' as const] }, { q: 3, marked: [] }, { q: 4, marked: ['D' as const] }],
  };
  it('flags are not errors, mark order does not matter, a skipped question is a silent error', () => {
    const r = checkStudent(truth, {
      isBackSide: false, studentName: '  ışıl öztürk ', nameConfidence: 'high', unreadable: false,
      answers: [
        { q: 1, marked: ['C'], confidence: 'low' },         // wrong but flagged → flagged
        { q: 2, marked: ['B', 'A'], confidence: 'high' },   // same set → right
        // q3 not reported → silent error, even though the truth is blank
        { q: 4, marked: ['E'], confidence: 'high' },        // silent error
      ],
    });
    expect(r).toMatchObject({ questions: 4, flagged: 1, silentWrong: 2, name: 'ok' });
    expect(r.mistakes).toEqual([{ q: 3, want: '—', got: '—' }, { q: 4, want: 'D', got: 'E' }]);
  });
  it('a different name is a wrong name', () => {
    const r = checkStudent(truth, { isBackSide: false, studentName: 'Işıl Öztürkmen', nameConfidence: 'high', unreadable: false, answers: [] });
    expect(r.name).toBe('wrong');
  });
});

describe('totals and summary', () => {
  it('adds sheets and turns them into rates, cost and time per page', () => {
    let t = emptyTotals();
    t = addSheet(t, { questions: 20, silentWrong: 0, flagged: 0, name: null, mistakes: [] }, { inputTokens: 2000, outputTokens: 400 }, 4000);
    t = addSheet(t, { questions: 20, silentWrong: 1, flagged: 2, name: 'ok', mistakes: [] }, { inputTokens: 2000, outputTokens: 600 }, 6000);
    expect(t).toEqual({ pages: 2, questions: 40, silentWrong: 1, flagged: 2, names: 1, namesOk: 1, tokensIn: 4000, tokensOut: 1000, ms: 10000 });
    // $5 in / $25 out per 1M: (4000*5 + 1000*25) / 1e6 = 0.045 over 2 pages
    expect(summarize(t, { inPerM: 5, outPerM: 25 })).toEqual({
      silentWrongRate: 2.5, flaggedRate: 5, nameAccuracy: 100, usdPerPage: 0.0225, secondsPerPage: 5,
    });
  });
  it('has no rates before anything was read', () => {
    expect(summarize(emptyTotals(), { inPerM: 5, outPerM: 25 })).toEqual({
      silentWrongRate: null, flaggedRate: null, nameAccuracy: null, usdPerPage: null, secondsPerPage: null,
    });
  });
});

describe('checkCriteria', () => {
  const gate = { tryPerUsd: 40, pagePriceTry: 50 / 150, concurrency: 4 };
  const pass = (summary: Parameters<typeof checkCriteria>[0]) =>
    Object.fromEntries(checkCriteria(summary, gate).map((c) => [c.key, c.pass]));
  it('passes exactly at each limit and fails just past it', () => {
    // 0.004 $ × 40 = ₺0.16 ≤ ₺0.1667; 40 s × 30 / 4 = 300 s
    expect(pass({ silentWrongRate: 0.2, flaggedRate: 5, nameAccuracy: 90, usdPerPage: 0.004, secondsPerPage: 40 }))
      .toEqual({ silentWrongRate: true, flaggedRate: true, nameAccuracy: true, costTry: true, classSeconds: true });
    // 0.005 $ × 40 = ₺0.20 > ₺0.1667; 41 s × 30 / 4 = 307.5 s
    expect(pass({ silentWrongRate: 0.21, flaggedRate: 5.1, nameAccuracy: 89.9, usdPerPage: 0.005, secondsPerPage: 41 }))
      .toEqual({ silentWrongRate: false, flaggedRate: false, nameAccuracy: false, costTry: false, classSeconds: false });
  });
  it('leaves a criterion undecided when there is no data for it', () => {
    expect(pass({ silentWrongRate: null, flaggedRate: null, nameAccuracy: null, usdPerPage: null, secondsPerPage: null }))
      .toEqual({ silentWrongRate: null, flaggedRate: null, nameAccuracy: null, costTry: null, classSeconds: null });
  });
});
