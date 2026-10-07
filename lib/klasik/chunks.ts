import type { Reader, Usage } from '@/lib/reader/types';
import { OutputTruncated } from '@/lib/reader/types';
import type { GradeOutput } from '@/lib/reader/schemas';

// A sheet's questions are graded a few at a time, the groups in parallel: one
// call for fifteen long answers can outrun the reader timeout or the output
// limit, and a failure then costs the whole sheet. Each group sees the photos
// it needs (the figures are judged per question anyway).
export const GRADE_CHUNK = 5;

type Input = Parameters<Reader['gradeKlasik']>[0];
type Out = { read: GradeOutput; usage: Usage };

const join = (outs: Out[]): Out => ({
  read: { questions: outs.flatMap((o) => o.read.questions) },
  usage: outs.reduce((u, o) => ({ inputTokens: u.inputTokens + o.usage.inputTokens, outputTokens: u.outputTokens + o.usage.outputTokens }), { inputTokens: 0, outputTokens: 0 }),
});

// One group; an answer cut off at the output limit would be cut off again on
// a retry, so the group is halved instead until the verdicts fit.
async function gradeGroup(reader: Reader, input: Input, idx: number[]): Promise<Out> {
  try {
    return await reader.gradeKlasik({
      questions: idx.map((i) => input.questions[i]),
      answers: idx.map((i) => input.answers[i]),
      images: idx.some((i) => input.answers[i].hasFigure) ? input.images : [],
      note: input.note,
    });
  } catch (e) {
    if (!(e instanceof OutputTruncated) || idx.length < 2) throw e;
    const mid = Math.ceil(idx.length / 2);
    return join(await Promise.all([gradeGroup(reader, input, idx.slice(0, mid)), gradeGroup(reader, input, idx.slice(mid))]));
  }
}

export async function gradeInChunks(reader: Reader, input: Input, size = GRADE_CHUNK): Promise<Out> {
  const groups: number[][] = [];
  for (let i = 0; i < input.questions.length; i += size) groups.push(Array.from({ length: Math.min(size, input.questions.length - i) }, (_, k) => i + k));
  return join(await Promise.all(groups.map((idx) => gradeGroup(reader, input, idx))));
}
