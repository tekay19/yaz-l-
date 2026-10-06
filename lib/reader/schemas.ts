import { z } from 'zod';
import { KLASIK_FLAGS } from '@/lib/types';

const Option = z.enum(['A', 'B', 'C', 'D', 'E']);
const Confidence = z.enum(['high', 'low']);

export const KeyReadSchema = z.object({
  questionCount: z.number().int(),
  answers: z.array(z.object({ q: z.number().int(), option: Option.nullable() })),
});

export const StudentReadSchema = z.object({
  isBackSide: z.boolean(),
  studentName: z.string().nullable(),
  nameConfidence: Confidence,
  unreadable: z.boolean(),
  answers: z.array(z.object({ q: z.number().int(), marked: z.array(Option), confidence: Confidence })),
});

// ── Klasik ────────────────────────────────────────────────────────────────
// No .optional() anywhere: OpenAI's strict JSON schema needs every property,
// so "not applicable" is always an explicit null.

export const KlasikReadSchema = z.object({
  isBackSide: z.boolean(),
  studentName: z.string().nullable(),
  nameConfidence: Confidence,
  unreadable: z.boolean(),
  answers: z.array(z.object({
    q: z.number().int(),
    lines: z.array(z.object({ text: z.string(), crossed: z.boolean() })),
    unclear: z.boolean(),
    hasFigure: z.boolean(),
  })),
});

export const RubricDraftSchema = z.object({
  questions: z.array(z.object({
    q: z.number().int(),
    type: z.enum(['islem', 'kisa', 'yorum']),
    prompt: z.string().nullable(),
    answer: z.string(),
    criteria: z.array(z.object({
      text: z.string(),
      points: z.number(),
      role: z.enum(['result', 'other']),
      required: z.boolean(),
    })),
    accepted: z.array(z.string()),
    workRequired: z.boolean(),
  })),
});
export type RubricDraft = z.infer<typeof RubricDraftSchema>;

export const GradeOutputSchema = z.object({
  questions: z.array(z.object({
    q: z.number().int(),
    criteria: z.array(z.object({ id: z.string(), verdict: z.enum(['met', 'partial', 'not_met']), evidence: z.string(), slipOnly: z.boolean() })),
    resultCorrect: z.boolean().nullable(),
    resultPath: z.enum(['valid', 'invalid', 'unsupported', 'none']).nullable(),
    firstError: z.string().nullable(),
    errorKind: z.enum(['islem', 'yontem']).nullable(),
    flags: z.array(z.enum(KLASIK_FLAGS)),
    confidence: Confidence,
    note: z.string(),
  })),
});
export type GradeOutput = z.infer<typeof GradeOutputSchema>;
