import { describe, expect, it, vi } from 'vitest';
import { createGeminiReader, type GeminiFetch } from '@/lib/reader/gemini';
import { OutputTruncated, ReadRefused } from '@/lib/reader/types';

const KEY_READ = { questionCount: 2, answers: [{ q: 1, option: 'A' }, { q: 2, option: null }] };
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
const reply = (json: unknown, finishReason = 'STOP') => ok({
  candidates: [{ finishReason, content: { parts: [{ text: 'düşünce', thought: true }, { text: JSON.stringify(json) }] } }],
  usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20, thoughtsTokenCount: 30 },
});

function fake(responses: any[]): GeminiFetch & { calls: any[] } {
  const calls: any[] = [];
  const f = (async (url: string, init: any) => { calls.push({ url, body: JSON.parse(init.body), headers: init.headers }); return responses.shift(); }) as any;
  f.calls = calls;
  return f;
}

describe('Gemini reader', () => {
  it('sends the shared prompt with a JSON schema and the photo, and counts thinking as output', async () => {
    const f = fake([reply(KEY_READ)]);
    const out = await createGeminiReader(f, { key: 'k', effort: 'low' }).readKey(Buffer.from('jpg'));
    expect(out.read).toEqual(KEY_READ);
    expect(out.usage).toEqual({ inputTokens: 100, outputTokens: 50 });
    const { url, body, headers } = f.calls[0];
    expect(url).toMatch(/models\/.+:generateContent$/);
    expect(headers['x-goog-api-key']).toBe('k');
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseJsonSchema.type).toBe('object');
    expect(body.generationConfig.thinkingConfig.thinkingLevel).toBe('low');
    expect(body.contents[0].parts[0].inlineData.mimeType).toBe('image/jpeg');
  });

  it('turns a safety block into ReadRefused and a cut-off answer into OutputTruncated', async () => {
    await expect(createGeminiReader(fake([ok({ promptFeedback: { blockReason: 'SAFETY' } })]), { key: 'k' }).readKey(Buffer.from('x')))
      .rejects.toBeInstanceOf(ReadRefused);
    await expect(createGeminiReader(fake([reply(KEY_READ, 'SAFETY')]), { key: 'k' }).readKey(Buffer.from('x')))
      .rejects.toBeInstanceOf(ReadRefused);
    await expect(createGeminiReader(fake([reply(KEY_READ, 'MAX_TOKENS')]), { key: 'k' }).readKey(Buffer.from('x')))
      .rejects.toBeInstanceOf(OutputTruncated);
  });

  it('waits and asks again when the API is busy, but not on a bad request', async () => {
    vi.useFakeTimers();
    const busy = { ok: false, status: 503, json: async () => ({}), text: async () => 'overloaded' };
    const f = fake([busy, reply(KEY_READ)]);
    const p = createGeminiReader(f, { key: 'k' }).readKey(Buffer.from('x'));
    await vi.runAllTimersAsync();
    await expect(p).resolves.toMatchObject({ read: KEY_READ });
    expect(f.calls).toHaveLength(2);
    vi.useRealTimers();
    const bad = { ok: false, status: 400, json: async () => ({}), text: async () => 'bad schema' };
    await expect(createGeminiReader(fake([bad]), { key: 'k' }).readKey(Buffer.from('x'))).rejects.toThrow('gemini_400');
  });
});
