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
  | 'missing' | 'grading_failed' | 'pending'
  | 'result_mismatch' | 'unstable_grade';

export const FLAG_TEXT: Record<ScoreFlag, string> = {
  alternative_path: 'Anahtardan farklı bir yöntem',
  alternative_answer: 'Anahtarda olmayan bir fikir kabul edildi, kontrol edin',
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
  result_mismatch: 'Sonuç anahtarla çelişiyor, kontrol edin',
  unstable_grade: 'İki değerlendirme farklı puan verdi, kontrol edin',
};

// Flags that explain the points without asking the teacher to act: each is
// a rule the code has already applied (a result through an invalid step or
// without work earns no result points, listing terms or addressing the grader
// earns nothing). Measured on the Turkish and foreign sets (2026-10-06), these
// were wrong in 0–14% of the answers they marked, against 40–50% for the flags
// that stay: wrong information, low confidence, a correct idea the key does
// not mention (alternative_answer), a wrong justification, and anything about
// the reading. A different valid method (alternative_path) only informs.
export const INFO_FLAGS: ReadonlySet<ScoreFlag> = new Set<ScoreFlag>([
  'alternative_path', 'invalid_path', 'unsupported_result', 'compensating_errors', 'off_topic', 'keywords_only', 'instruction_in_answer', 'pending',
]);

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
  // graded twice or looked at again, and the grades disagree: the points of
  // the one that did not decide
  altPoints?: number;
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

// The numbers of a final answer — its last line, after the last "=" (never
// the "=" of "<=" or ">="), "⇒" or "→" — in order, as written: a comma is a
// decimal one only before one to three digits ("5,006", "2,5"; "[800,1200]"
// is two numbers), and a minus is a sign only right before a number ("x = -5").
export function finalNumbers(text: string): string[] {
  const line = text.replace(/−/g, '-').split('\n').map((l) => l.trim()).filter(Boolean).pop() ?? '';
  const tail = line.split(/(?<![<>≤≥!])=(?!>)|⇒|=>|→|->/).pop() ?? '';
  return (tail.match(/(?:(?<=^|[\s=(\[;:])-)?\d+(?:[.,]\d{1,3}(?!\d))?/g) ?? [])
    .map((n) => n.replace(',', '.').replace(/^(-?)0+(?=\d)/, '$1'));
}

// The key's final answer: the value its result criterion names ("Sonuç doğru
// …: K = 5006"), else the key's answer when it ends in an expression; a key
// written as prose gives none, and the question is not checked.
function keyFinal(rq: RubricQuestion): string {
  const named = rq.criteria.find((c) => c.role === 'result')?.text.match(/sonuç[^:]*:\s*(.+)$/i)?.[1];
  if (named) return named;
  return /[=≤≥<>]/.test(rq.answer) || rq.answer.length <= 40 ? rq.answer : '';
}

export function scoreQuestion(
  rq: RubricQuestion, answer: KlasikAnswer | undefined, grade: QuestionGrade | undefined, teacherPoints?: number,
): QuestionScore {
  const max = questionMax(rq);
  const g = grade ?? null;
  const base = { q: rq.q, max, grade: g };
  if (teacherPoints !== undefined) {
    // next to the teacher's points, the verdicts that decided the suggestion
    const shown = g?.review && !g.review.failed && g.review.rev === g.rev ? g.review : g;
    return { ...base, grade: shown, points: clamp(halfPoints(teacherPoints), 0, max), status: 'teacher', flags: [], criteria: describe(rq, shown) };
  }
  if (!answer) return { ...base, points: 0, status: 'missing', flags: ['missing'], criteria: describe(rq, null) };
  const text = answerText(answer);
  if (!text.trim()) return { ...base, points: 0, status: 'blank', flags: [], criteria: describe(rq, null) };
  if (!g || g.rev !== rq.rev) return { ...base, points: 0, status: 'pending', flags: ['pending'], criteria: describe(rq, g) };
  if (g.failed) return { ...base, points: 0, status: 'failed', flags: ['grading_failed'], criteria: describe(rq, null) };

  const flags = new Set<ScoreFlag>(g.flags);
  if (answer.hasFigure) flags.add('figure');
  // the reader was unsure, or two readers disagreed: the teacher checks the reading
  if (answer.unclear) flags.add('unclear_reading');
  if (g.textOnly) flags.add('text_only');
  if (g.confidence === 'low') flags.add('low_confidence');
  // the code's own finding that the verdicts contradict each other, unlike the
  // model's doubt, is never settled by a second grading
  let contradiction = false;

  const hasResult = rq.type !== 'yorum';
  // the result against the key, by its numbers: a result the model calls right
  // whose numbers are not the key's, or one it calls wrong that has exactly
  // the key's numbers, is a contradiction the teacher should see
  if (hasResult && g.resultCorrect !== null) {
    const key = finalNumbers(keyFinal(rq));
    const mine = finalNumbers(text);
    if (key.length && mine.length) {
      // "right" needs every key number somewhere in the result (an equal form
      // may add some); "wrong" is contradicted only by the very same numbers
      // in the same order (|x - 3| ≤ 32 is not |x - 32| ≤ 3)
      const covered = key.every((n) => mine.includes(n));
      const same = key.length === mine.length && key.every((n, i) => n === mine[i]);
      if (g.resultCorrect ? !covered : same) flags.add('result_mismatch');
    }
  }
  const path = g.resultPath;
  const correct = g.resultCorrect === true;
  // bare: only the result is written. Written steps that do not lead to the
  // result ("unsupported") never stand in for it, whether or not the work was
  // asked for: the paper shows a reason that is not one.
  const bare = path === 'none';
  const resultAllowed = correct && (path === 'valid' || (!rq.policy.workRequired && bare));
  if (hasResult && correct && path === 'invalid') flags.add('invalid_path');
  if (hasResult && correct && (path === 'unsupported' || (bare && rq.policy.workRequired))) flags.add('unsupported_result');
  // where no work was asked for, that reason now costs the result: the teacher
  // sees it, since a step the reading missed looks the same
  if (hasResult && correct && path === 'unsupported' && !rq.policy.workRequired) flags.add('wrong_justification');

  // resultCorrect is one answer for the whole question; with several result
  // criteria (a kisa question in parts) it only contradicts a sheet where
  // every one of them is met — one wrong part makes it false honestly
  const resultIds = rq.criteria.filter((c) => c.role === 'result').map((c) => c.id);
  const allResultsMet = resultIds.every((id) => g.criteria.find((x) => x.id === id)?.verdict === 'met');

  let points = 0;
  const criteria = rq.criteria.map((c): ScoredCriterion => {
    const v = g.criteria.find((x) => x.id === c.id);
    // carry-forward, applied here rather than left to the model: a method
    // criterion whose step is right but for an arithmetic slip is met; the
    // result criterion still loses its points for the wrong result
    const slipKept = rq.policy.carryForward && c.role !== 'result' && v?.slipOnly === true && Boolean(v.evidence.trim());
    const verdict: Verdict = slipKept ? 'met' : v?.verdict ?? 'not_met';
    const evidence = v?.evidence ?? '';
    let counted = true;
    // a drawing cannot be quoted; figure questions always go to the teacher instead
    if (verdict !== 'not_met' && !answer.hasFigure && !quoteFound(evidence, text)) {
      counted = false;
      flags.add('evidence_unverified');
    }
    if (hasResult && c.role === 'result') {
      if (rq.type === 'kisa') {
        // a short answer has no steps to check: its result criterion stands on
        // its verdict (partial = half), unless the model contradicts itself
        if (verdict === 'met' && g.resultCorrect === false && allResultsMet) {
          counted = false;
          flags.add('low_confidence');
          contradiction = true;
        }
      } else if (!resultAllowed) counted = false;
    }
    const earned = !counted ? 0 : verdict === 'met' ? c.points : verdict === 'partial' ? c.points / 2 : 0;
    points += earned;
    return { id: c.id, text: c.text, points: c.points, role: c.role, verdict, evidence, earned, counted };
  });
  // a bare answer to a question that asks for the work earns nothing ...
  if (hasResult && rq.policy.workRequired && path === 'none') points = 0;
  // ... and full marks when only the result was asked for — but only for a
  // result the paper shows: the result criterion met, with its quote found
  if (hasResult && !rq.policy.workRequired && correct && bare) {
    const shown = criteria.some((c) => c.role === 'result' && c.counted && c.verdict === 'met');
    if (shown) points = max;
    // "correct" without a met result criterion: the model contradicts itself
    else if (!flags.has('evidence_unverified')) { flags.add('low_confidence'); contradiction = true; }
  }
  const scored: QuestionScore = { ...base, points: clamp(halfPoints(points), 0, max), status: 'graded', flags: [...flags], criteria };
  const apart = (a: number, b: number) => Math.abs(a - b) >= Math.max(2, 0.15 * max);
  const usable = (x: QuestionGrade | null | undefined): x is QuestionGrade => Boolean(x && !x.failed && x.rev === g.rev);
  // graded twice: two clearly different points mean an unsure judgment
  const alt = usable(g.second) ? scoreQuestion(rq, answer, { ...g.second, second: null, review: null }).points : undefined;
  // looked at again by a stronger model where this grading was unsure: its
  // verdicts decide the points, but the doubt is settled only when every
  // grade agrees. Measured on 50 math sheets (2026-10-08): settling it when
  // the stronger model agreed with just one of the two let 7.4% of the
  // answers through wrong by 5+ points without a word, against 6.1% this way
  // (49% asked without the second look, 39% and 45% with it).
  if (usable(g.review)) {
    const decided = scoreQuestion(rq, answer, { ...g.review, second: null, review: null });
    const firsts = [scored.points, ...(alt === undefined ? [] : [alt])];
    if (firsts.every((p) => !apart(p, decided.points))) return decided;
    const other = firsts.find((p) => apart(p, decided.points))!;
    return { ...decided, flags: [...decided.flags, 'unstable_grade'], altPoints: other };
  }
  if (alt !== undefined && apart(alt, scored.points)) return { ...scored, flags: [...scored.flags, 'unstable_grade'], altPoints: alt };
  // two gradings that agree on nothing or on full marks settle the model's own
  // doubt: it no longer asks the teacher. Measured on 700 answers (2026-10-09):
  // 4-6 points fewer questions asked for one more answer off by 5+ points
  // unflagged; settling it on any agreement quieted answers that were off by
  // 2+ points more than half the time, so partial credit keeps asking.
  if (alt !== undefined && g.confidence === 'low' && !contradiction && (scored.points === 0 || scored.points === max)) {
    return { ...scored, flags: scored.flags.filter((f) => f !== 'low_confidence') };
  }
  return scored;
}

// The doubts a second grading could settle: what asks for the teacher's
// attention, but not the reader's own doubt or a figure, which go to the
// teacher whatever another grading says.
export function gradeDoubts(rq: RubricQuestion, answer: KlasikAnswer, grade: QuestionGrade): ScoreFlag[] {
  const s = scoreQuestion(rq, { ...answer, unclear: false }, grade);
  return attentionFlags(s).filter((f) => f !== 'figure' && f !== 'text_only');
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
