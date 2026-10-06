import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { clientOptions, type Effort } from './config';
import { OutputTruncated, ReadRefused, buildReader, type Ask, type Reader } from './types';

// Same contract as the Claude reader, on the OpenAI Responses API. Chosen with
// GRADER_PROVIDER=openai; the prompts and output schemas are shared, so the
// measurement screen compares the two providers on equal terms.

// The slice of the SDK we use, so tests can hand in a fake.
export type ResponsesClient = { responses: { create(params: any): Promise<any> } };

export const openaiModel = () => process.env.GRADER_MODEL || 'gpt-5.1';

const transport = (client: ResponsesClient, model: string): Ask => async (system, parts, schema, name, effort) => {
  const res = await client.responses.create({
    model,
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
  if (res.status === 'incomplete' && res.incomplete_details?.reason === 'max_output_tokens') throw new OutputTruncated('max_output_tokens');
  const text = out.find((c: any) => c.type === 'output_text')?.text;
  if (!text) throw new Error(`no_output:${res.status}:${res.incomplete_details?.reason ?? ''}`);
  return {
    read: schema.parse(JSON.parse(text)),
    usage: { inputTokens: res.usage?.input_tokens ?? 0, outputTokens: res.usage?.output_tokens ?? 0 },
  };
};

export const createOpenAIReader = (
  client: ResponsesClient = new OpenAI(clientOptions()) as unknown as ResponsesClient,
  opts: { effort?: Effort; model?: string } = {},
): Reader => buildReader(transport(client, opts.model ?? openaiModel()), opts);
