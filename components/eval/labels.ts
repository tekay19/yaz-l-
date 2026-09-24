// What the admin enters on the measurement screen, and how it becomes the
// "truth" lib/eval/metrics compares a reading with. Labels are entered blind
// (the screen never shows the model's reading first), so the truth cannot
// lean towards what the model said.

import type { KeyTruth, StudentTruth } from '@/lib/eval/metrics';
import type { Option } from '@/lib/types';

// Each label carries its own question count, like eval/data/*.json: changing
// the count later must not turn unlabelled questions into silent "blank"s.
// A key question needs an explicit choice: 'blank' when the key leaves it empty.
export type KeyLabel = {
  kind: 'key'; questionCount: number; answers: Record<number, Option | 'blank'>; done: boolean;
};
// A student question left untouched means nothing is marked on the paper.
export type StudentLabel = {
  kind: 'student'; questionCount: number; name: string; marks: Record<number, Option[]>; done: boolean;
};
export type Label = KeyLabel | StudentLabel;
export type Labels = Record<string, Label>;

const questions = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

export function missingKeyAnswers(label: KeyLabel): number[] {
  return questions(label.questionCount).filter((q) => !label.answers[q]);
}

// Why the admin cannot confirm this label yet, or null when they can.
export function labelGap(label: Label): string | null {
  if (label.kind === 'student') return label.name.trim() ? null : 'Öğrencinin kâğıda yazdığı adı girin.';
  const missing = missingKeyAnswers(label);
  return missing.length ? `Seçilmeyen sorular: ${missing.join(', ')}` : null;
}

export function keyTruth(label: KeyLabel): KeyTruth {
  return {
    kind: 'key',
    questionCount: label.questionCount,
    answers: questions(label.questionCount).map((q) => {
      const a = label.answers[q];
      return { q, option: !a || a === 'blank' ? null : a };
    }),
  };
}

export function studentTruth(label: StudentLabel): StudentTruth {
  return {
    kind: 'student',
    questionCount: label.questionCount,
    studentName: label.name.trim(),
    answers: questions(label.questionCount).map((q) => ({ q, marked: [...(label.marks[q] ?? [])].sort() })),
  };
}

// Photos are never stored; labels are, keyed by what the file picker gives back
// when the admin selects the same photo again.
export const fileKey = (f: { name: string; size: number }) => `${f.name}:${f.size}`;

// ── Browser storage ──────────────────────────────────────────────────────
// Per-browser convenience only: storage can be blocked (private window) or
// full, and then the labels simply live in memory for this visit.
type Store = { getItem(key: string): string | null; setItem(key: string, value: string): void };
const STORE_KEY = 'sinavoku:olcum:v1';

export function loadLabels(store: Store | undefined): Labels {
  try {
    const v: unknown = JSON.parse(store?.getItem(STORE_KEY) ?? '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Labels) : {};
  } catch {
    return {};
  }
}

export function saveLabels(store: Store | undefined, labels: Labels): void {
  try {
    store?.setItem(STORE_KEY, JSON.stringify(labels));
  } catch {
    // blocked or full: the labels stay in memory
  }
}

// window.localStorage itself throws where site data is blocked.
export function browserStore(): Store | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
