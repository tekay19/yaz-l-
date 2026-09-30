import type { QuestionGrade, RubricQuestion } from '@/lib/types';
import type { GradeOutput } from '@/lib/reader/schemas';

export type GradedOut = GradeOutput['questions'][number];

// The model's answer for one question, kept as a grade stamped with the
// rubric revision it was made against. Criteria the rubric does not have are
// dropped; the ones the model skipped count as "not met" when scored.
export function toGrade(rq: RubricQuestion, out: GradedOut, textOnly: boolean): QuestionGrade {
  const ids = new Set(rq.criteria.map((c) => c.id));
  const yorum = rq.type === 'yorum';
  return {
    q: rq.q,
    rev: rq.rev,
    criteria: out.criteria.filter((c) => ids.has(c.id)).map((c) => ({ id: c.id, verdict: c.verdict, evidence: c.evidence.slice(0, 300) })),
    resultCorrect: yorum ? null : out.resultCorrect,
    resultPath: yorum ? null : out.resultPath,
    firstError: out.firstError ? out.firstError.slice(0, 300) : null,
    errorKind: out.errorKind,
    flags: [...new Set(out.flags)],
    // a figure judged without its photo is a guess the teacher has to check
    confidence: textOnly ? 'low' : out.confidence,
    note: out.note.slice(0, 400),
    failed: false,
    textOnly,
  };
}

// Grading gave up on this question: the teacher enters the points.
export function failedGrade(rq: RubricQuestion): QuestionGrade {
  return {
    q: rq.q, rev: rq.rev, criteria: [], resultCorrect: null, resultPath: null, firstError: null,
    errorKind: null, flags: [], confidence: 'low', note: '', failed: true, textOnly: false,
  };
}
