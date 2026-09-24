// The accuracy gate's arithmetic (eval/README.md), shared by
// scripts/eval-reader.ts and the admin measurement screen so both judge a
// reading the same way. What matters for grading is a WRONG read that is NOT
// flagged low confidence: flagged reads cost teacher time, silent ones cost
// a student a wrong grade.

import type { KeyRead, Option, StudentRead } from '@/lib/types';

export type KeyTruth = { kind: 'key'; questionCount: number; answers: { q: number; option: Option | null }[] };
export type StudentTruth = {
  kind: 'student'; questionCount: number; studentName: string;
  answers: { q: number; marked: Option[] }[];
};
export type Truth = KeyTruth | StudentTruth;

export type Mistake = { q: number; want: string; got: string };
export type SheetResult = {
  questions: number; silentWrong: number; flagged: number;
  name: 'ok' | 'wrong' | null; // null for a key sheet, which has no name
  mistakes: Mistake[];
};

const show = (v: Option[] | Option | null | undefined) =>
  Array.isArray(v) ? (v.length ? [...v].sort().join('') : '—') : (v ?? '—');

export function checkKey(truth: KeyTruth, read: KeyRead): SheetResult {
  const out: SheetResult = { questions: 0, silentWrong: 0, flagged: 0, name: null, mistakes: [] };
  for (const t of truth.answers) {
    out.questions++;
    const got = read.answers.find((a) => a.q === t.q)?.option ?? null;
    if (got !== t.option) {
      out.silentWrong++;
      out.mistakes.push({ q: t.q, want: show(t.option), got: show(got) });
    }
  }
  return out;
}

export function checkStudent(truth: StudentTruth, read: StudentRead): SheetResult {
  const out: SheetResult = { questions: 0, silentWrong: 0, flagged: 0, name: null, mistakes: [] };
  out.name = read.studentName?.trim().toLocaleLowerCase('tr') === truth.studentName.toLocaleLowerCase('tr') ? 'ok' : 'wrong';
  for (const t of truth.answers) {
    out.questions++;
    const got = read.answers.find((a) => a.q === t.q);
    if (got?.confidence === 'low') {
      out.flagged++;
      continue;
    }
    // a question the model did not report at all counts as a silent error
    const same = got && [...got.marked].sort().join() === [...t.marked].sort().join();
    if (!same) {
      out.silentWrong++;
      out.mistakes.push({ q: t.q, want: show(t.marked), got: show(got?.marked) });
    }
  }
  return out;
}

export type Totals = {
  pages: number; questions: number; silentWrong: number; flagged: number;
  names: number; namesOk: number; tokensIn: number; tokensOut: number; ms: number;
};

export const emptyTotals = (): Totals => ({
  pages: 0, questions: 0, silentWrong: 0, flagged: 0, names: 0, namesOk: 0, tokensIn: 0, tokensOut: 0, ms: 0,
});

export function addSheet(t: Totals, sheet: SheetResult, usage: { inputTokens: number; outputTokens: number }, ms: number): Totals {
  return {
    pages: t.pages + 1,
    questions: t.questions + sheet.questions,
    silentWrong: t.silentWrong + sheet.silentWrong,
    flagged: t.flagged + sheet.flagged,
    names: t.names + (sheet.name ? 1 : 0),
    namesOk: t.namesOk + (sheet.name === 'ok' ? 1 : 0),
    tokensIn: t.tokensIn + usage.inputTokens,
    tokensOut: t.tokensOut + usage.outputTokens,
    ms: t.ms + ms,
  };
}

export type Prices = { inPerM: number; outPerM: number }; // USD per 1M tokens
export type Summary = {
  silentWrongRate: number | null; flaggedRate: number | null; nameAccuracy: number | null; // percent
  usdPerPage: number | null; secondsPerPage: number | null;
};

export function summarize(t: Totals, prices: Prices): Summary {
  const pct = (n: number, d: number) => (d ? (n / d) * 100 : null);
  const usd = (t.tokensIn * prices.inPerM + t.tokensOut * prices.outPerM) / 1e6;
  return {
    silentWrongRate: pct(t.silentWrong, t.questions),
    flaggedRate: pct(t.flagged, t.questions),
    nameAccuracy: pct(t.namesOk, t.names),
    usdPerPage: t.pages ? usd / t.pages : null,
    secondsPerPage: t.pages ? t.ms / 1000 / t.pages : null,
  };
}

// pagePriceTry: the cheapest per-page price a teacher pays (Başlangıç: ₺50 / 150)
export type Gate = { tryPerUsd: number; pagePriceTry: number; concurrency: number; classSize?: number };
export type Check = { key: string; label: string; value: number | null; limit: string; pass: boolean | null };

export function checkCriteria(s: Summary, g: Gate): Check[] {
  const classSize = g.classSize ?? 30;
  const costTry = s.usdPerPage === null ? null : s.usdPerPage * g.tryPerUsd;
  const classSeconds = s.secondsPerPage === null ? null : (s.secondsPerPage * classSize) / g.concurrency;
  const judge = (v: number | null, ok: (v: number) => boolean) => (v === null ? null : ok(v));
  const maxCost = g.pagePriceTry / 2;
  return [
    { key: 'silentWrongRate', label: 'Sessiz yanlış oranı (%)', value: s.silentWrongRate, limit: '≤ 0,2', pass: judge(s.silentWrongRate, (v) => v <= 0.2) },
    { key: 'flaggedRate', label: 'İşaretlenen oran (%)', value: s.flaggedRate, limit: '≤ 5', pass: judge(s.flaggedRate, (v) => v <= 5) },
    { key: 'nameAccuracy', label: 'İsim doğruluğu (%)', value: s.nameAccuracy, limit: '≥ 90', pass: judge(s.nameAccuracy, (v) => v >= 90) },
    { key: 'costTry', label: 'Sayfa başı maliyet (₺)', value: costTry, limit: `≤ ${maxCost.toFixed(3)}`, pass: judge(costTry, (v) => v <= maxCost) },
    { key: 'classSeconds', label: `${classSize} kâğıtlık sınıf süresi (sn)`, value: classSeconds, limit: '≤ 300', pass: judge(classSeconds, (v) => v <= 300) },
  ];
}
