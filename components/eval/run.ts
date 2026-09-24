// One measurement run: each labelled photo's reading scored against its label
// with lib/eval/metrics (the same arithmetic as scripts/eval-reader.ts), the
// running totals, and the JSON the admin downloads to fill eval/README.md.

import {
  addSheet, checkCriteria, checkKey, checkStudent, emptyTotals, summarize,
  type Gate, type Prices, type SheetResult, type Truth,
} from '@/lib/eval/metrics';
import type { KeyRead, Option, StudentRead } from '@/lib/types';
import type { EvalRead } from './api';
import { keyTruth, studentTruth, type Label } from './labels';

export type Run =
  | ({ ok: true; file: string; kind: Label['kind']; truth: Truth; result: SheetResult } & EvalRead)
  | { ok: false; file: string; kind: Label['kind']; truth: Truth; error: string };
type Read = Extract<Run, { ok: true }>;

export function score(file: string, label: Label, out: EvalRead): Run {
  if (label.kind === 'key') {
    const truth = keyTruth(label);
    return { ok: true, file, kind: 'key', truth, ...out, result: checkKey(truth, out.read as KeyRead) };
  }
  const truth = studentTruth(label);
  return { ok: true, file, kind: 'student', truth, ...out, result: checkStudent(truth, out.read as StudentRead) };
}

export const failed = (file: string, label: Label, error: string): Run =>
  ({ ok: false, file, kind: label.kind, truth: label.kind === 'key' ? keyTruth(label) : studentTruth(label), error });

// A photo the API could not read is left out of the rates, but counted: in
// production it lands on the teacher's "okunamadı" list, it is not graded.
export function tally(runs: Run[]) {
  let totals = emptyTotals();
  let failedCount = 0;
  let keys = 0;
  let students = 0;
  for (const r of runs) {
    if (!r.ok) {
      failedCount++;
      continue;
    }
    totals = addSheet(totals, r.result, r.usage, r.ms);
    if (r.kind === 'key') keys++;
    else students++;
  }
  return { totals, failed: failedCount, keys, students };
}

export function report(runs: Run[], o: { at: string; prices: Prices; gate: Gate }) {
  const { totals, failed: failedCount, keys, students } = tally(runs);
  const summary = summarize(totals, o.prices);
  const first = runs.find((r): r is Read => r.ok);
  return {
    at: o.at,
    model: first?.model ?? null,
    effort: first?.effort ?? null,
    prices: o.prices,
    gate: o.gate,
    keys,
    students,
    failed: failedCount,
    totals,
    summary,
    criteria: checkCriteria(summary, o.gate),
    sheets: runs,
  };
}

// ── Quick entry ──────────────────────────────────────────────────────────
// One token per question, separated by spaces or commas: letters are the
// marks ("AC" = two marks), "-" is blank. Anything else is refused, not guessed.
export type Quick = { ok: true; marks: Record<number, Option[]> } | { ok: false; error: string };

export function parseQuick(text: string, kind: Label['kind'], questionCount: number): Quick {
  const tokens = text.split(/[\s,;]+/).filter(Boolean);
  if (tokens.length > questionCount) return { ok: false, error: `${questionCount} soru var, ${tokens.length} cevap yazıldı.` };
  const marks: Record<number, Option[]> = {};
  for (const [i, token] of tokens.entries()) {
    const q = i + 1;
    if (token === '-') {
      marks[q] = [];
      continue;
    }
    const up = token.toUpperCase();
    if (!/^[A-E]+$/.test(up)) return { ok: false, error: `${q}. soru: "${token}" okunamadı. A–E ya da boş için - yazın.` };
    const letters = [...new Set(up)].sort() as Option[];
    if (kind === 'key' && letters.length > 1) return { ok: false, error: `${q}. soru: anahtarda tek şık olur ("${token}").` };
    marks[q] = letters;
  }
  return { ok: true, marks };
}
