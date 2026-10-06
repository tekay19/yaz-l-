import set from '@/eval/klasik/goruntu-seti/cases.json';
import type { Rubric } from '@/lib/types';
import { normalizeName } from '@/lib/grading/names';

// The demo exam: the 6-question klasik exam of the AI-image set
// (eval/klasik/goruntu-seti). Its 15 made-up students have known points, so
// the demo can show the expected score next to the system's own.

export const DEMO_RUBRIC = set.rubric as unknown as Rubric;

// in sheet order: s01 … s15
const STUDENTS = [
  'Elif Yıldız', 'Mert Kaya', 'Zeynep Arslan', 'Emre Demir', 'Ayşe Çelik', 'Burak Şahin', 'Selin Öztürk', 'Can Aydın',
  'Deniz Koç', 'Ece Kurt', 'Ali Polat', 'İrem Güneş', 'Oğuz Tekin', 'Melis Acar', 'Kaan Yurt',
];

export type Expected = { sheet: string; total: number; questions: { q: number; points: number }[] };

export function expectedFor(name: string | null): Expected | null {
  const key = normalizeName(name ?? '');
  const i = key ? STUDENTS.findIndex((s) => normalizeName(s) === key) : -1;
  if (i < 0) return null;
  const sheet = `s${String(i + 1).padStart(2, '0')}`;
  const questions = set.cases
    .filter((c) => c.id.startsWith(`${sheet}-`))
    .map((c) => ({ q: c.q, points: c.teacher }));
  return { sheet, total: questions.reduce((s, x) => s + x.points, 0), questions };
}
