import type { KeyRead, Option } from '@/lib/types';

export type Outcome = 'correct' | 'wrong' | 'blank' | 'multi' | 'nokey';
export type SheetScore = {
  correct: number; wrong: number; blank: number; score: number;
  questions: { q: number; outcome: Outcome; marked: Option[] }[];
  flags: string[];
};

export function scoreSheet(
  key: KeyRead,
  answers: { q: number; marked: Option[]; confidence?: 'high' | 'low' }[],
): SheetScore {
  const byQ = new Map(answers.map((a) => [a.q, a]));
  const out: SheetScore = { correct: 0, wrong: 0, blank: 0, score: 0, questions: [], flags: [] };
  let keyed = 0;

  for (const k of [...key.answers].sort((a, b) => a.q - b.q)) {
    const a = byQ.get(k.q);
    const marked = a?.marked ?? [];
    if (a?.confidence === 'low') out.flags.push(`${k.q}. soru net okunamadı`);
    let outcome: Outcome;
    if (k.option === null) outcome = 'nokey';
    else if (marked.length === 0) outcome = 'blank';
    else if (marked.length > 1) outcome = 'multi';
    else outcome = marked[0] === k.option ? 'correct' : 'wrong';

    if (k.option !== null) keyed++;
    if (outcome === 'correct') out.correct++;
    if (outcome === 'wrong' || outcome === 'multi') out.wrong++;
    if (outcome === 'blank') out.blank++;
    if (outcome === 'multi') out.flags.push(`${k.q}. soruda birden fazla işaret`);
    out.questions.push({ q: k.q, outcome, marked });
  }
  out.score = keyed ? Math.round((out.correct / keyed) * 100) : 0;
  return out;
}
