import { afterEach, describe, expect, it } from 'vitest';
import { ReadRefused } from '@/lib/reader/types';
import { createOpenAIReader, type ResponsesClient } from '@/lib/reader/openai';

const reply = (json: unknown, status = 'completed') => ({
  status,
  output: [
    { type: 'reasoning', summary: [] },
    { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(json) }] },
  ],
  usage: { input_tokens: 1500, output_tokens: 250 },
});

function fakeClient(responses: unknown[]): ResponsesClient & { calls: any[] } {
  const calls: any[] = [];
  return { calls, responses: { create: async (params: any) => { calls.push(params); return responses.shift() as any; } } };
}

describe('openai reader', () => {
  afterEach(() => { delete process.env.GRADER_MODEL; });

  it('parses a student sheet and reports usage', async () => {
    const client = fakeClient([reply({
      isBackSide: false, studentName: 'Elif Yılmaz', nameConfidence: 'high', unreadable: false,
      answers: [{ q: 1, marked: ['A'], confidence: 'high' }],
    })]);
    const out = await createOpenAIReader(client).readStudent(Buffer.from('jpg'), 20);
    expect(out.read.studentName).toBe('Elif Yılmaz');
    expect(out.usage).toEqual({ inputTokens: 1500, outputTokens: 250 });
    const sent = client.calls[0];
    expect(sent.input[0].content[0].image_url).toMatch(/^data:image\/jpeg;base64,/);
    expect(sent.input[0].content[1].text).toMatch(/20 questions/);
    expect(sent.text.format.type).toBe('json_schema');
    expect(sent.text.format.strict).toBe(true);
  });

  it('throws ReadRefused on a refusal', async () => {
    const client = fakeClient([{
      status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }], usage: {},
    }]);
    await expect(createOpenAIReader(client).readKey(Buffer.from('jpg'))).rejects.toBeInstanceOf(ReadRefused);
  });

  // Out of tokens mid-answer: fail the read so the queue retries it, never
  // hand a partial sheet to scoring.
  it('fails an incomplete response', async () => {
    const client = fakeClient([{
      status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [{ type: 'reasoning' }], usage: {},
    }]);
    await expect(createOpenAIReader(client).readKey(Buffer.from('jpg'))).rejects.toThrow(/max_output_tokens/);
  });

  it('reads at the effort and model it is given', async () => {
    process.env.GRADER_MODEL = 'gpt-test';
    const client = fakeClient([reply({ questionCount: 1, answers: [{ q: 1, option: 'A' }] })]);
    await createOpenAIReader(client, { effort: 'low' }).readKey(Buffer.from('jpg'));
    expect(client.calls[0].reasoning.effort).toBe('low');
    expect(client.calls[0].model).toBe('gpt-test');
  });

  it('rejects output that breaks the schema', async () => {
    const client = fakeClient([reply({ questionCount: 'ten', answers: [] })]);
    await expect(createOpenAIReader(client).readKey(Buffer.from('jpg'))).rejects.toThrow();
  });
});
