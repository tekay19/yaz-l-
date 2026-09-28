import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type { z } from 'zod';
import { KeyReadSchema, StudentReadSchema } from './schemas';
import { KEY_SYSTEM, KEY_USER, STUDENT_SYSTEM, studentUser } from './prompts';
import { ReadRefused, type Effort, type Reader, type Usage } from './claude';

// Same contract as the Claude reader, on the OpenAI Responses API. Chosen with
// GRADER_PROVIDER=openai; the prompts and output schemas are shared, so the
// measurement screen compares the two providers on equal terms.

// The slice of the SDK we use, so tests can hand in a fake.
export type ResponsesClient = { responses: { create(params: any): Promise<any> } };

export const openaiModel = () => process.env.GRADER_MODEL || 'gpt-5.1';
const EFFORT = () => (process.env.GRADER_EFFORT || 'medium') as Effort;

async function read<T>(
  client: ResponsesClient,
  system: string,
  userText: string,
  image: Buffer,
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
      content: [
        { type: 'input_image', image_url: `data:image/jpeg;base64,${image.toString('base64')}`, detail: 'high' },
        { type: 'input_text', text: userText },
      ],
    }],
  });
  const parts = (res.output ?? []).filter((o: any) => o.type === 'message').flatMap((o: any) => o.content ?? []);
  if (parts.some((c: any) => c.type === 'refusal')) throw new ReadRefused('refused');
  const text = parts.find((c: any) => c.type === 'output_text')?.text;
  if (!text) throw new Error(`no_output:${res.status}:${res.incomplete_details?.reason ?? ''}`);
  return {
    read: schema.parse(JSON.parse(text)),
    usage: { inputTokens: res.usage?.input_tokens ?? 0, outputTokens: res.usage?.output_tokens ?? 0 },
  };
}

export function createOpenAIReader(
  client: ResponsesClient = new OpenAI() as unknown as ResponsesClient,
  opts: { effort?: Effort } = {},
): Reader {
  const effort = () => opts.effort ?? EFFORT();
  return {
    readKey: (image) => read(client, KEY_SYSTEM, KEY_USER, image, KeyReadSchema, 'answer_key', effort()),
    readStudent: (image, questionCount) =>
      read(client, STUDENT_SYSTEM, studentUser(questionCount), image, StudentReadSchema, 'student_sheet', effort()),
  };
}
