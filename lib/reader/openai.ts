import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type { z } from 'zod';
import {
  GradeOutputSchema, KeyReadSchema, KlasikReadSchema, RubricDraftSchema, StudentReadSchema,
} from './schemas';
import { KEY_SYSTEM, KEY_USER, STUDENT_SYSTEM, studentUser } from './prompts';
import { GRADE_SYSTEM, KLASIK_READ_SYSTEM, KLASIK_READ_USER, RUBRIC_SYSTEM, gradeUser, rubricUser } from './klasik-prompts';
import { clientOptions, effortFor, type CallKind, type Effort } from './config';
import { ReadRefused, type Part, type Reader, type Usage } from './claude';

// Same contract as the Claude reader, on the OpenAI Responses API. Chosen with
// GRADER_PROVIDER=openai; the prompts and output schemas are shared, so the
// measurement screen compares the two providers on equal terms.

// The slice of the SDK we use, so tests can hand in a fake.
export type ResponsesClient = { responses: { create(params: any): Promise<any> } };

export const openaiModel = () => process.env.GRADER_MODEL || 'gpt-5.1';

async function ask<T>(
  client: ResponsesClient,
  system: string,
  parts: Part[],
  schema: z.ZodType<T>,
  name: string,
  effort: Effort,
): Promise<{ read: T; usage: Usage }> {
  const res = await client.responses.create({
    model: openaiModel(),
    max_output_tokens: 16000,
    reasoning: { effort },
    instructions: system,
    text: { format: zodTextFormat(schema as any, name) },
    input: [{
      role: 'user',
      content: parts.map((p) => ('image' in p
        ? { type: 'input_image', image_url: `data:image/jpeg;base64,${p.image.toString('base64')}`, detail: 'high' }
        : { type: 'input_text', text: p.text })),
    }],
  });
  const out = (res.output ?? []).filter((o: any) => o.type === 'message').flatMap((o: any) => o.content ?? []);
  if (out.some((c: any) => c.type === 'refusal')) throw new ReadRefused('refused');
  const text = out.find((c: any) => c.type === 'output_text')?.text;
  if (!text) throw new Error(`no_output:${res.status}:${res.incomplete_details?.reason ?? ''}`);
  return {
    read: schema.parse(JSON.parse(text)),
    usage: { inputTokens: res.usage?.input_tokens ?? 0, outputTokens: res.usage?.output_tokens ?? 0 },
  };
}

export function createOpenAIReader(
  client: ResponsesClient = new OpenAI(clientOptions()) as unknown as ResponsesClient,
  opts: { effort?: Effort } = {},
): Reader {
  const effort = (kind: CallKind) => opts.effort ?? effortFor(kind);
  return {
    readKey: (image) => ask(client, KEY_SYSTEM, [{ image }, { text: KEY_USER }], KeyReadSchema, 'answer_key', effort('optik')),
    readStudent: (image, questionCount) =>
      ask(client, STUDENT_SYSTEM, [{ image }, { text: studentUser(questionCount) }], StudentReadSchema, 'student_sheet', effort('optik')),
    readKlasik: (image) =>
      ask(client, KLASIK_READ_SYSTEM, [{ image }, { text: KLASIK_READ_USER }], KlasikReadSchema, 'klasik_page', effort('klasik-read')),
    draftRubric: ({ keyText, maxPoints }) =>
      ask(client, RUBRIC_SYSTEM, [{ text: rubricUser(keyText, maxPoints) }], RubricDraftSchema, 'klasik_rubric', effort('klasik-grade')),
    gradeKlasik: ({ questions, answers, images }) =>
      ask(client, GRADE_SYSTEM, [...images.map((image) => ({ image })), { text: gradeUser(questions, answers, images.length > 0) }],
        GradeOutputSchema, 'klasik_grade', effort('klasik-grade')),
  };
}
