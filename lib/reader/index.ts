import { createClaudeReader } from './claude';
import type { Effort, Reader } from './types';
import { createOpenAIReader } from './openai';
import { createGeminiReader } from './gemini';
import { crossReadKlasik } from './cross';

// Which model does what, from the environment:
//   READER_PROVIDER / READER_MODEL           copying pages down (optik and klasik)
//   GRADER_PROVIDER / GRADER_MODEL           rubric drafts and grading
//   CROSS_READ_PROVIDER / CROSS_READ_MODEL   a second, independent klasik reading
// Providers: "anthropic" (default), "openai", "gemini". With only GRADER_* set
// one model does everything, as before. A call that fails on one provider
// (an outage, an exhausted quota) is retried once on the other one.

type Provider = 'anthropic' | 'openai' | 'gemini';
const DEFAULT_MODEL: Record<Provider, string> = {
  anthropic: 'claude-opus-5', openai: 'gpt-5.6-terra', gemini: 'gemini-3.8-flash',
};
const asProvider = (p: string | undefined): Provider | null => (p === 'openai' || p === 'gemini' || p === 'anthropic' ? p : null);

type Role = { provider: Provider; model: string };
export function roles(env: NodeJS.ProcessEnv = process.env) {
  const graderProvider = asProvider(env.GRADER_PROVIDER) ?? 'anthropic';
  const grader: Role = { provider: graderProvider, model: env.GRADER_MODEL || DEFAULT_MODEL[graderProvider] };
  const readerProvider = asProvider(env.READER_PROVIDER);
  const reader: Role = readerProvider
    ? { provider: readerProvider, model: env.READER_MODEL || (readerProvider === graderProvider ? grader.model : DEFAULT_MODEL[readerProvider]) }
    : grader;
  const crossProvider = asProvider(env.CROSS_READ_PROVIDER);
  const cross: Role | null = crossProvider ? { provider: crossProvider, model: env.CROSS_READ_MODEL || DEFAULT_MODEL[crossProvider] } : null;
  return { reader, grader, cross };
}

function make(role: Role, effort?: Effort): Reader {
  const opts = { effort, model: role.model };
  if (role.provider === 'openai') return createOpenAIReader(undefined, opts);
  if (role.provider === 'gemini') return createGeminiReader(undefined, opts);
  return createClaudeReader(undefined, opts);
}

// Try the main reader; on failure, the other provider once.
function fallback<A extends unknown[], R>(main: (...a: A) => Promise<R>, spare: ((...a: A) => Promise<R>) | null, what: string) {
  if (!spare) return main;
  return async (...a: A): Promise<R> => {
    try {
      return await main(...a);
    } catch (e) {
      console.error(`[reader] ${what} failed, trying the other provider`, e instanceof Error ? e.message.slice(0, 200) : e);
      return spare(...a);
    }
  };
}

export function createReader(opts: { effort?: Effort } = {}): Reader {
  const r = roles();
  const reader = make(r.reader, opts.effort);
  const grader = r.grader.provider === r.reader.provider && r.grader.model === r.reader.model ? reader : make(r.grader, opts.effort);
  const cross = r.cross ? make(r.cross, opts.effort) : null;
  // the spare is the other configured provider, never the same one twice
  const spareFor = (role: Role) => [r.grader, r.reader, r.cross].find((x) => x && x.provider !== role.provider) ?? null;
  const readSpare = spareFor(r.reader) ? make(spareFor(r.reader)!, opts.effort) : null;
  const gradeSpare = spareFor(r.grader) ? make(spareFor(r.grader)!, opts.effort) : null;
  return {
    readKey: fallback(reader.readKey, readSpare?.readKey ?? null, 'readKey'),
    readStudent: fallback(reader.readStudent, readSpare?.readStudent ?? null, 'readStudent'),
    readKlasik: cross ? crossReadKlasik(reader, cross) : fallback(reader.readKlasik, readSpare?.readKlasik ?? null, 'readKlasik'),
    draftRubric: fallback(grader.draftRubric, gradeSpare?.draftRubric ?? null, 'draftRubric'),
    gradeKlasik: fallback(grader.gradeKlasik, gradeSpare?.gradeKlasik ?? null, 'gradeKlasik'),
  };
}

export const readerModel = () => roles().reader.model;
export const graderModelName = () => roles().grader.model;
