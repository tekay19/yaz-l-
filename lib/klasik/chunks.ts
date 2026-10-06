import type { Reader, Usage } from '@/lib/reader/types';
import type { GradeOutput } from '@/lib/reader/schemas';

// A sheet's questions are graded a few at a time, the groups in parallel: one
// call for fifteen long answers can outrun the reader timeout or the output
// limit, and a failure then costs the whole sheet. Each group sees the photos
// it needs (the figures are judged per question anyway).
export const GRADE_CHUNK = 5;

type Input = Parameters<Reader['gradeKlasik']>[0];

export async function gradeInChunks(reader: Reader, input: Input, size = GRADE_CHUNK): Promise<{ read: GradeOutput; usage: Usage }> {
  const groups: number[][] = [];
  for (let i = 0; i < input.questions.length; i += size) groups.push(Array.from({ length: Math.min(size, input.questions.length - i) }, (_, k) => i + k));
  const outs = await Promise.all(groups.map((idx) => reader.gradeKlasik({
    questions: idx.map((i) => input.questions[i]),
    answers: idx.map((i) => input.answers[i]),
    images: idx.some((i) => input.answers[i].hasFigure) ? input.images : [],
    note: input.note,
  })));
  return {
    read: { questions: outs.flatMap((o) => o.read.questions) },
    usage: outs.reduce((u, o) => ({ inputTokens: u.inputTokens + o.usage.inputTokens, outputTokens: u.outputTokens + o.usage.outputTokens }), { inputTokens: 0, outputTokens: 0 }),
  };
}
