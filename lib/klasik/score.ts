import type {
  KlasikAnswer, KlasikFlag, KlasikGrade, KlasikRead, PageOverride, QuestionGrade, Rubric, RubricQuestion, Verdict,
} from '@/lib/types';
import { quoteFound } from './evidence';
import { answerText } from './sheets';

// Points for klasik answers. The model only judges criteria; everything that
// decides a number is here, deterministic and testable:
//   - a verdict counts only with a quote that is really in the answer
//   - the result criterion needs a correct result that follows from the
//     student's own valid steps (a correct answer alone is not evidence)
//   - "partial" is half the criterion; totals are rounded to half points
//   - the teacher's own points override everything

export type ScoreFlag =
  | KlasikFlag
  | 'evidence_unverified' | 'figure' | 'text_only' | 'low_confidence'
  | 'missing' | 'grading_failed' | 'pending';

export const FLAG_TEXT: Record<ScoreFlag, string> = {
  alternative_path: 'Anahtardan farklı bir yöntem',
  invalid_path: 'Sonuç doğru ama geçersiz bir adımdan geçiyor',
  compensating_errors: 'İki hata birbirini götürmüş görünüyor',
  unsupported_result: 'Sonuç doğru ama yazılı işlemlerden çıkmıyor',
  unclear_reading: 'Okuma belirsiz',
  wrong_info: 'Cevapta yanlış bilgi var',
  keywords_only: 'Kavramlar sayılmış, açıklanmamış',
  wrong_justification: 'Gerekçe hatalı',
  off_topic: 'Cevap soruyla ilgili değil',
  instruction_in_answer: 'Cevapta değerlendirene yönelik bir yazı var (puan kazandırmaz)',
  evidence_unverified: 'Kanıt okumada bulunamadı',
  figure: 'Şekilli soru, kontrol edin',
  text_only: 'Şekil fotoğrafsız değerlendirildi',
  low_confidence: 'Emin değil, kontrol edin',
  missing: 'Kâğıtta bulunamadı',
  grading_failed: 'Puanlanamadı, puanı elle girin',
  pending: 'Puanlanıyor',
};

// Flags that only inform: they do not ask the teacher to act.
export const INFO_FLAGS: ReadonlySet<ScoreFlag> = new Set<ScoreFlag>(['alternative_path', 'pending']);

export type ScoredCriterion = {
  id: string; text: string; points: number; role: 'result' | 'other';
  verdict: Verdict | null; evidence: string; earned: number; counted: boolean;
};
export type QuestionScore = {
  q: number; max: number; points: number;
  status: 'graded' | 'teacher' | 'blank' | 'missing' | 'pending' | 'failed';
  flags: ScoreFlag[];
  criteria: ScoredCriterion[];
  grade: QuestionGrade | null;
};
export type SheetScore = { total: number; max: number; percent: number; questions: QuestionScore[]; pending: number };

export const questionMax = (rq: RubricQuestion) => rq.criteria.reduce((s, c) => s + c.points, 0);
export const halfPoints = (n: number) => Math.round(n * 2) / 2;
const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

// The verdicts as they stand, before any rule is applied; for the screens.
function describe(rq: RubricQuestion, grade: QuestionGrade | null): ScoredCriterion[] {
  return rq.criteria.map((c) => {
    const v = grade?.criteria.find((x) => x.id === c.id);
    return { id: c.id, text: c.text, points: c.points, role: c.role, verdict: v?.verdict ?? null, evidence: v?.evidence ?? '', earned: 0, counted: false };
  });
}

export function scoreQuestion(
  rq: RubricQuestion, answer: KlasikAnswer | undefined, grade: QuestionGrade | undefined, teacherPoints?: number,
): QuestionScore {
  const max = questionMax(rq);
  const g = grade ?? null;
  const base = { q: rq.q, max, grade: g };
  if (teacherPoints !== undefined) {
    return { ...base, points: clamp(halfPoints(teacherPoints), 0, max), status: 'teacher', flags: [], criteria: describe(rq, g) };
  }
  if (!answer) return { ...base, points: 0, status: 'missing', flags: ['missing'], criteria: describe(rq, null) };
  const text = answerText(answer);
  if (!text.trim()) return { ...base, points: 0, status: 'blank', flags: [], criteria: describe(rq, null) };
  if (!g || g.rev !== rq.rev) return { ...base, points: 0, status: 'pending', flags: ['pending'], criteria: describe(rq, g) };
  if (g.failed) return { ...base, points: 0, status: 'failed', flags: ['grading_failed'], criteria: describe(rq, null) };

  const flags = new Set<ScoreFlag>(g.flags);
  if (answer.hasFigure) flags.add('figure');
  if (g.textOnly) flags.add('text_only');
  if (g.confidence === 'low') flags.add('low_confidence');

  const hasResult = rq.type !== 'yorum';
  const path = g.resultPath;
  const correct = g.resultCorrect === true;
  const bare = path === 'none' || path === 'unsupported';
  const resultAllowed = correct && (path === 'valid' || (!rq.policy.workRequired && bare));
  if (hasResult && correct && path === 'invalid') flags.add('invalid_path');
  if (hasResult && correct && bare && rq.policy.workRequired) flags.add('unsupported_result');

  let points = 0;
  const criteria = rq.criteria.map((c): ScoredCriterion => {
    const v = g.criteria.find((x) => x.id === c.id);
    const verdict: Verdict = v?.verdict ?? 'not_met';
    const evidence = v?.evidence ?? '';
    let counted = true;
    // a drawing cannot be quoted; figure questions always go to the teacher instead
    if (verdict !== 'not_met' && !answer.hasFigure && !quoteFound(evidence, text)) {
      counted = false;
      flags.add('evidence_unverified');
    }
    if (hasResult && c.role === 'result' && !resultAllowed) counted = false;
    const earned = !counted ? 0 : verdict === 'met' ? c.points : verdict === 'partial' ? c.points / 2 : 0;
    points += earned;
    return { id: c.id, text: c.text, points: c.points, role: c.role, verdict, evidence, earned, counted };
  });
  // a bare answer to a question that asks for the work earns nothing ...
  if (hasResult && rq.policy.workRequired && path === 'none') points = 0;
  // ... and full marks when only the result was asked for
  if (hasResult && !rq.policy.workRequired && correct && bare) points = max;
  return { ...base, points: clamp(halfPoints(points), 0, max), status: 'graded', flags: [...flags], criteria };
}

export function scoreSheet(
  rubric: Rubric, sheet: { read: KlasikRead; override: PageOverride; grade: KlasikGrade | null },
): SheetScore {
  const questions = rubric.questions.map((rq) => scoreQuestion(
    rq,
    sheet.read.answers.find((a) => a.q === rq.q),
    sheet.grade?.questions.find((g) => g.q === rq.q),
    sheet.override.points?.find((p) => p.q === rq.q)?.points,
  ));
  const total = halfPoints(questions.reduce((s, x) => s + x.points, 0));
  const max = questions.reduce((s, x) => s + x.max, 0);
  return {
    total, max, percent: max ? Math.round((total / max) * 100) : 0, questions,
    pending: questions.filter((x) => x.status === 'pending').length,
  };
}

// The flags that ask for the teacher's attention on a scored question.
export const attentionFlags = (s: QuestionScore) =>
  (s.status === 'teacher' ? [] : s.flags.filter((f) => !INFO_FLAGS.has(f)));
