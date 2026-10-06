import { z } from 'zod';
import { readerTimeoutMs, type Effort } from './config';
import { OutputTruncated, ReadRefused, buildReader, type Ask, type Reader } from './types';

// Same contract as the Claude and OpenAI readers, on the Gemini API
// (generateContent over REST, no SDK). Chosen with GRADER_PROVIDER=gemini;
// the prompts and output schemas are shared with the other providers.

// The one call we make, so tests can hand in a fake.
export type GeminiFetch = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) =>
  Promise<{ ok: boolean; status: number; json(): Promise<any>; text(): Promise<string> }>;

export const geminiModel = () => process.env.GRADER_MODEL || 'gemini-pro-latest';

const BLOCKED = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION', 'IMAGE_SAFETY']);
// a busy or rate-limited API answers again a few seconds later; anything else
// is the queue's business
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRY_WAIT_MS = [2_000, 8_000, 20_000];
const MAX_RETRY_WAIT_MS = 60_000;

// a rate limit says how long to wait ("retryDelay": "23s"); else the fixed steps
async function waitMs(res: Awaited<ReturnType<GeminiFetch>>, attempt: number): Promise<number> {
  if (res.status === 429) {
    const body = await res.json().catch(() => null);
    const delay = body?.error?.details?.find((d: any) => d.retryDelay)?.retryDelay;
    const s = typeof delay === 'string' ? parseFloat(delay) : NaN;
    if (Number.isFinite(s)) return Math.min(MAX_RETRY_WAIT_MS, Math.ceil(s * 1000) + 500);
  }
  return RETRY_WAIT_MS[attempt];
}

// Gemini's schema dialect wants plain JSON Schema without the $schema header.
function jsonSchema(schema: z.ZodType) {
  const { $schema: _, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
}

const transport = (doFetch: GeminiFetch, key: string, model: string): Ask => async (system, parts, schema, _name, effort) => {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{
      role: 'user',
      parts: parts.map((p) => ('image' in p
        ? { inlineData: { mimeType: 'image/jpeg', data: p.image.toString('base64') } }
        : { text: p.text })),
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: jsonSchema(schema),
      maxOutputTokens: 32_000,
      thinkingConfig: { thinkingLevel: effort },
    },
  });
  let res!: Awaited<ReturnType<GeminiFetch>>;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await doFetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body,
        signal: AbortSignal.timeout(readerTimeoutMs()),
      });
    } catch (e) {
      // a dropped connection or a DNS hiccup is worth one more try; a timeout is not
      const timedOut = e instanceof Error && e.name === 'TimeoutError';
      if (timedOut || attempt >= RETRY_WAIT_MS.length) throw e;
      await new Promise((r) => setTimeout(r, RETRY_WAIT_MS[attempt]));
      continue;
    }
    if (res.ok || !RETRY_STATUS.has(res.status) || attempt >= RETRY_WAIT_MS.length) break;
    const wait = await waitMs(res, attempt);
    await new Promise((r) => setTimeout(r, wait));
  }
  if (!res.ok) throw new Error(`gemini_${res.status}: ${(await res.text()).slice(0, 300)}`);
  const out = await res.json();
  if (out.promptFeedback?.blockReason) throw new ReadRefused(`blocked:${out.promptFeedback.blockReason}`);
  const cand = out.candidates?.[0];
  if (BLOCKED.has(cand?.finishReason)) throw new ReadRefused(`blocked:${cand.finishReason}`);
  if (cand?.finishReason === 'MAX_TOKENS') throw new OutputTruncated('max_tokens');
  const text = (cand?.content?.parts ?? []).filter((p: any) => !p.thought && typeof p.text === 'string').map((p: any) => p.text).join('');
  if (!text) throw new Error(`no_output:${cand?.finishReason ?? 'none'}`);
  const u = out.usageMetadata ?? {};
  return {
    read: schema.parse(JSON.parse(text)),
    // thinking is billed as output
    usage: { inputTokens: u.promptTokenCount ?? 0, outputTokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) },
  };
};

export function createGeminiReader(
  doFetch: GeminiFetch = (url, init) => fetch(url, init),
  opts: { effort?: Effort; key?: string; model?: string } = {},
): Reader {
  const key = opts.key ?? process.env.GEMINI_API_KEY ?? '';
  return buildReader(transport(doFetch, key, opts.model ?? geminiModel()), opts);
}
