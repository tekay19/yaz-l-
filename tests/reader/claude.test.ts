import { describe, expect, it } from 'vitest';
import { createClaudeReader, ReadRefused, type MessagesClient } from '@/lib/reader/claude';

const reply = (json: unknown, stop_reason = 'end_turn') => ({
  stop_reason,
  content: [{ type: 'text', text: JSON.stringify(json) }],
  usage: { input_tokens: 1800, output_tokens: 300 },
});

function fakeClient(responses: unknown[]): MessagesClient & { calls: any[] } {
  const calls: any[] = [];
  return {
    calls,
    beta: { messages: { create: async (params: any) => { calls.push(params); return responses.shift() as any; } } },
  };
}

describe('claude reader', () => {
  it('parses a student sheet and reports usage', async () => {
    const client = fakeClient([reply({
      isBackSide: false, studentName: 'Elif Yılmaz', nameConfidence: 'high', unreadable: false,
      answers: [{ q: 1, marked: ['A'], confidence: 'high' }],
    })]);
    const out = await createClaudeReader(client).readStudent(Buffer.from('jpg'), 20);
    expect(out.read.studentName).toBe('Elif Yılmaz');
    expect(out.usage).toEqual({ inputTokens: 1800, outputTokens: 300 });
    const sent = client.calls[0];
    expect(sent.messages[0].content[0].source.media_type).toBe('image/jpeg');
    expect(sent.output_config.format).toBeDefined();
  });

  it('throws ReadRefused on a refusal', async () => {
    const client = fakeClient([{ stop_reason: 'refusal', content: [], usage: { input_tokens: 0, output_tokens: 0 } }]);
    await expect(createClaudeReader(client).readKey(Buffer.from('jpg'))).rejects.toBeInstanceOf(ReadRefused);
  });

  it('rejects output that breaks the schema', async () => {
    const client = fakeClient([reply({ questionCount: 'ten', answers: [] })]);
    await expect(createClaudeReader(client).readKey(Buffer.from('jpg'))).rejects.toThrow();
  });
});
