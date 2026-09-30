import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';
import type { KeyRead, KlasikAnswer, KlasikRead, RubricQuestion, StudentRead } from '@/lib/types';
import {
  GradeOutputSchema, KeyReadSchema, KlasikReadSchema, RubricDraftSchema, StudentReadSchema,
  type GradeOutput, type RubricDraft,
} from './schemas';
import { KEY_SYSTEM, KEY_USER, STUDENT_SYSTEM, studentUser } from './prompts';
import { GRADE_SYSTEM, KLASIK_READ_SYSTEM, KLASIK_READ_USER, RUBRIC_SYSTEM, gradeUser, rubricUser } from './klasik-prompts';
import { clientOptions, effortFor, type CallKind, type Effort } from './config';

export type { Effort } from './config';
export type Usage = { inputTokens: number; outputTokens: number };
export type Reader = {
  readKey(image: Buffer): Promise<{ read: KeyRead; usage: Usage }>;
  readStudent(image: Buffer, questionCount: number): Promise<{ read: StudentRead; usage: Usage }>;
  // klasik: copy a page down, draft a rubric from the key, judge answers
  readKlasik(image: Buffer): Promise<{ read: KlasikRead; usage: Usage }>;
  draftRubric(input: { keyText: string; maxPoints: number[] }): Promise<{ read: RubricDraft; usage: Usage }>;
  gradeKlasik(input: { questions: RubricQuestion[]; answers: KlasikAnswer[]; images: Buffer[] }): Promise<{ read: GradeOutput; usage: Usage }>;
};
export class ReadRefused extends Error {}

// The slice of the SDK we use, so tests can hand in a fake.
export type MessagesClient = { beta: { messages: { create(params: any): Promise<any> } } };

export const graderModel = () => process.env.GRADER_MODEL || 'claude-opus-5';

// What goes in the user turn: photos first, then the text that asks about them.
export type Part = { image: Buffer } | { text: string };

async function ask<T>(
  client: MessagesClient,
  system: string,
  parts: Part[],
  schema: z.ZodType<T>,
  effort: Effort,
): Promise<{ read: T; usage: Usage }> {
  const res = await client.beta.messages.create({
    model: graderModel(),
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort, format: betaZodOutputFormat(schema) },
    // on a policy decline the API retries on a fallback model in the same call
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content: parts.map((p) => ('image' in p
        ? { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: p.image.toString('base64') } }
        : { type: 'text', text: p.text })),
    }],
  });
  if (res.stop_reason === 'refusal') throw new ReadRefused('refused');
  const text = res.content.find((b: any) => b.type === 'text')?.text;
  if (!text) throw new Error(`no_output:${res.stop_reason}`);
  return {
    read: schema.parse(JSON.parse(text)),
    usage: { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens },
  };
}

// opts.effort overrides the environment, so the measurement screen can
// compare effort levels on the same sheets without restarting the server.
export function createClaudeReader(
  client: MessagesClient = new Anthropic(clientOptions()) as unknown as MessagesClient,
  opts: { effort?: Effort } = {},
): Reader {
  const effort = (kind: CallKind) => opts.effort ?? effortFor(kind);
  return {
    readKey: (image) => ask(client, KEY_SYSTEM, [{ image }, { text: KEY_USER }], KeyReadSchema, effort('optik')),
    readStudent: (image, questionCount) =>
      ask(client, STUDENT_SYSTEM, [{ image }, { text: studentUser(questionCount) }], StudentReadSchema, effort('optik')),
    readKlasik: (image) =>
      ask(client, KLASIK_READ_SYSTEM, [{ image }, { text: KLASIK_READ_USER }], KlasikReadSchema, effort('klasik-read')),
    draftRubric: ({ keyText, maxPoints }) =>
      ask(client, RUBRIC_SYSTEM, [{ text: rubricUser(keyText, maxPoints) }], RubricDraftSchema, effort('klasik-grade')),
    gradeKlasik: ({ questions, answers, images }) =>
      ask(client, GRADE_SYSTEM, [...images.map((image) => ({ image })), { text: gradeUser(questions, answers, images.length > 0) }],
        GradeOutputSchema, effort('klasik-grade')),
  };
}
