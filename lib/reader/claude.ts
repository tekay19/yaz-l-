import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { clientOptions, type Effort } from './config';
import { OutputTruncated, ReadRefused, buildReader, type Ask, type Reader } from './types';

// The slice of the SDK we use, so tests can hand in a fake.
export type MessagesClient = { beta: { messages: { create(params: any): Promise<any> } } };

export const graderModel = () => process.env.GRADER_MODEL || 'claude-opus-5';

const transport = (client: MessagesClient, model: string): Ask => async (system, parts, schema, _name, effort) => {
  const res = await client.beta.messages.create({
    model,
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
  if (res.stop_reason === 'max_tokens') throw new OutputTruncated('max_tokens');
  const text = res.content.find((b: any) => b.type === 'text')?.text;
  if (!text) throw new Error(`no_output:${res.stop_reason}`);
  return {
    read: schema.parse(JSON.parse(text)),
    // cache reads and writes are input too: leaving them out made the cost look lower than billed
    usage: {
      inputTokens: res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0),
      outputTokens: res.usage.output_tokens,
    },
  };
};

export const createClaudeReader = (
  client: MessagesClient = new Anthropic(clientOptions()) as unknown as MessagesClient,
  opts: { effort?: Effort; model?: string } = {},
): Reader => buildReader(transport(client, opts.model ?? graderModel()), opts);
