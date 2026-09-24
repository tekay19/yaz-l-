import { z } from 'zod';

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
