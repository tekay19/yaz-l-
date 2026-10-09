import { z } from 'zod';
import { GRADING_STYLES, type AcceptedPath, type GradingStyle, type Rubric, type RubricQuestion, type ScoredExample } from '@/lib/types';
import type { RubricDraft } from '@/lib/reader/schemas';
import { halfPoints } from './score';

export const DEFAULT_MAX = 10;
export const MAX_QUESTIONS = 50;
export const MAX_CRITERIA = 8;
export const MAX_ACCEPTED = 20;
export const MAX_SCORED = 10;

// What the rubric editor may send. The limits keep a hostile body from
// storing megabytes in a JSONB column.
const CriterionZ = z.object({
  id: z.string().trim().min(1).max(20),
  text: z.string().trim().min(1).max(300),
  points: z.number().positive().max(100),
  role: z.enum(['result', 'other']),
  required: z.boolean(),
});
const QuestionZ = z.object({
  q: z.number().int().min(1).max(200),
  type: z.enum(['islem', 'kisa', 'yorum']),
  prompt: z.string().trim().max(2000).nullable(),
  answer: z.string().trim().max(4000),
  criteria: z.array(CriterionZ).min(1).max(MAX_CRITERIA)
    .refine((cs) => new Set(cs.map((c) => c.id)).size === cs.length, 'Bir soruda iki ölçüt aynı kimliği taşıyor.'),
  accepted: z.array(z.object({
    text: z.string().trim().min(1).max(500),
    example: z.string().max(4000).nullable(),
    by: z.enum(['ai', 'teacher']),
  })).max(MAX_ACCEPTED),
  policy: z.object({ workRequired: z.boolean(), carryForward: z.boolean(), wrongInfoPenalty: z.boolean(), style: z.enum(GRADING_STYLES).optional(), formRequired: z.boolean().optional() }),
});
export const RubricInput = z.object({
  questions: z.array(QuestionZ).max(MAX_QUESTIONS)
    .refine((qs) => new Set(qs.map((x) => x.q)).size === qs.length, 'Aynı soru numarası iki kez var.'),
});
export type RubricInputData = z.infer<typeof RubricInput>;

export const emptyRubric = (): Rubric => ({ questions: [] });

// The editor's rubric, before approval: nothing is graded yet, so every
// question starts at revision 1.
export function fromInput(input: RubricInputData): Rubric {
  return {
    questions: [...input.questions].sort((a, b) => a.q - b.q).map((x) => ({
      ...x,
      rev: 1,
      prompt: x.prompt || null,
      criteria: x.criteria.map((c) => ({ ...c, role: x.type === 'yorum' ? 'other' as const : c.role })),
    })),
  };
}

// Why a rubric cannot be approved yet, in Turkish; [] when it can.
export function rubricProblems(r: Rubric | null): string[] {
  if (!r?.questions.length) return ['Cevap anahtarında hiç soru bulunamadı.'];
  return r.questions.filter((q) => !q.criteria.length).map((q) => `${q.q}. sorunun cevabı anahtarda okunamadı.`);
}

// Spread criterion weights over the question's maximum in half points; the
// rounding drift is settled on the largest criteria so the total is exact.
// Every criterion is worth at least half a point, so a caller must not pass
// more than max / 0.5 of them.
export function splitPoints(weights: number[], max: number): number[] {
  const sum = weights.reduce((s, w) => s + w, 0) || 1;
  const pts = weights.map((w) => Math.max(0.5, halfPoints((w / sum) * max)));
  let drift = halfPoints(max - pts.reduce((s, p) => s + p, 0));
  if (drift > 0) pts[pts.indexOf(Math.max(...pts))] += drift;
  while (drift < 0) {
    const i = pts.indexOf(Math.max(...pts));
    const take = Math.min(-drift, pts[i] - 0.5);
    if (take <= 0) break;
    pts[i] = halfPoints(pts[i] - take);
    drift += take;
  }
  return pts;
}

// At most max / 0.5 criteria, keeping the heaviest (and the result one), in
// their original order.
function fitCriteria<T extends { points: number; role: string }>(crits: T[], max: number): T[] {
  const room = Math.max(1, Math.floor(max * 2));
  if (crits.length <= room) return crits;
  const ranked = crits.map((c, i) => ({ c, i }))
    .sort((a, b) => Number(b.c.role === 'result') - Number(a.c.role === 'result') || b.c.points - a.c.points);
  return ranked.slice(0, room).sort((a, b) => a.i - b.i).map((x) => x.c);
}

// The model's draft → a rubric the teacher can approve as it is: each
// question carries the teacher's maximum (10 when none was given), its
// criteria add up to it, and the policies start at the agreed defaults.
export function normalizeDraft(draft: RubricDraft, maxPoints: number[], style: GradingStyle = 'balanced'): Rubric {
  const seen = new Set<number>();
  const questions: RubricQuestion[] = [];
  for (const d of [...draft.questions].sort((a, b) => a.q - b.q)) {
    if (!Number.isInteger(d.q) || d.q < 1 || d.q > 200 || seen.has(d.q)) continue;
    seen.add(d.q);
    const max = maxPoints[d.q - 1] > 0 ? maxPoints[d.q - 1] : DEFAULT_MAX;
    const yorum = d.type === 'yorum';
    let crits = fitCriteria(d.criteria.filter((c) => c.text.trim() && c.points > 0).slice(0, MAX_CRITERIA), max);
    if (!crits.length) crits = [{ text: 'Cevap doğru', points: max, role: yorum ? 'other' : 'result', required: false }];
    const points = splitPoints(crits.map((c) => c.points), max);
    questions.push({
      q: d.q,
      rev: 1,
      type: d.type,
      prompt: d.prompt?.trim().slice(0, 2000) || null,
      answer: d.answer.trim().slice(0, 4000),
      criteria: crits.map((c, i) => ({
        id: `c${i + 1}`, text: c.text.trim().slice(0, 300), points: points[i], role: yorum ? 'other' : c.role, required: c.required,
      })),
      accepted: d.accepted.map((t) => t.trim()).filter(Boolean).slice(0, MAX_ACCEPTED)
        .map((text) => ({ text: text.slice(0, 500), example: null, by: 'ai' as const })),
      policy: { workRequired: d.type === 'islem' ? d.workRequired : false, carryForward: true, wrongInfoPenalty: false, style },
    });
    if (questions.length >= MAX_QUESTIONS) break;
  }
  return { questions };
}

// "Accept this answer": the teacher's example becomes a way to full credit,
// and the question's new revision sends it back for grading on every sheet
// the teacher has not scored by hand.
export function amendRubric(r: Rubric, q: number, path: AcceptedPath): Rubric {
  return {
    questions: r.questions.map((x) => (x.q !== q ? x : {
      ...x, rev: x.rev + 1, accepted: [...x.accepted, path].slice(-MAX_ACCEPTED),
    })),
  };
}

// "Grade the others like this": the answers the teacher scored by hand become
// the question's examples (full, partial or no credit), and its new revision
// sends it back for grading on every sheet they have not scored.
export function scoreLike(r: Rubric, q: number, scored: ScoredExample[], style?: GradingStyle): Rubric {
  return {
    questions: r.questions.map((x) => (x.q !== q ? x : {
      ...x, rev: x.rev + 1, scored: scored.slice(-MAX_SCORED), policy: style ? { ...x.policy, style } : x.policy,
    })),
  };
}
