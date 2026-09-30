import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';
import type { KeyRead, StudentRead } from '@/lib/types';
import { KeyReadSchema, StudentReadSchema } from './schemas';
import { KEY_SYSTEM, KEY_USER, STUDENT_SYSTEM, studentUser } from './prompts';
import { clientOptions } from './config';

export type Usage = { inputTokens: number; outputTokens: number };
export type Reader = {
  readKey(image: Buffer): Promise<{ read: KeyRead; usage: Usage }>;
  readStudent(image: Buffer, questionCount: number): Promise<{ read: StudentRead; usage: Usage }>;
};
export class ReadRefused extends Error {}

// The slice of the SDK we use, so tests can hand in a fake.
export type MessagesClient = { beta: { messages: { create(params: any): Promise<any> } } };

export type Effort = 'low' | 'medium' | 'high';
export const graderModel = () => process.env.GRADER_MODEL || 'claude-opus-5';
const EFFORT = () => (process.env.GRADER_EFFORT || 'medium') as Effort;

async function read<T>(
  client: MessagesClient,
  system: string,
  userText: string,
  image: Buffer,
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
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image.toString('base64') } },
        { type: 'text', text: userText },
      ],
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

// opts.effort overrides GRADER_EFFORT, so the measurement screen can compare
// effort levels on the same sheets without restarting the server.
export function createClaudeReader(
  client: MessagesClient = new Anthropic(clientOptions()) as unknown as MessagesClient,
  opts: { effort?: Effort } = {},
): Reader {
  const effort = () => opts.effort ?? EFFORT();
  return {
    readKey: (image) => read(client, KEY_SYSTEM, KEY_USER, image, KeyReadSchema, effort()),
    readStudent: (image, questionCount) =>
      read(client, STUDENT_SYSTEM, studentUser(questionCount), image, StudentReadSchema, effort()),
  };
}
