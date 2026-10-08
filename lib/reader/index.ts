import { createClaudeReader } from './claude';
import { OutputTruncated, type Effort, type Reader, type Usage } from './types';
import { readerTimeoutMs } from './config';
import { LEASE_MS } from '@/lib/queue';
import type { KlasikRead } from '@/lib/types';
import { createOpenAIReader } from './openai';
import { createGeminiReader } from './gemini';
import { crossReadKlasik } from './cross';

// Which model does what, from the environment:
//   READER_PROVIDER / READER_MODEL           copying pages down (optik and klasik)
//   GRADER_PROVIDER / GRADER_MODEL           rubric drafts and grading
//   CROSS_READ_PROVIDER / CROSS_READ_MODEL   a second, independent klasik reading
//   ESCALATE_PROVIDER / ESCALATE_MODEL       a stronger model asked only where the
//                                            others were unsure: a klasik page with
//                                            an unclear answer is read again, and a
//                                            doubtful grade graded again. It also
//                                            drafts the rubric: one call per exam
//                                            whose every point split reaches every
//                                            sheet, so worth the stronger model
// Providers: "anthropic" (default), "openai", "gemini". With only GRADER_* set
// one model does everything, as before. A call that fails on one provider
// (an outage, an exhausted quota) is retried once on the other one.

type Provider = 'anthropic' | 'openai' | 'gemini';
const DEFAULT_MODEL: Record<Provider, string> = {
  anthropic: 'claude-opus-5', openai: 'gpt-5.6-terra', gemini: 'gemini-3.8-flash',
};
const asProvider = (p: string | undefined): Provider | null => (p === 'openai' || p === 'gemini' || p === 'anthropic' ? p : null);

type Role = { provider: Provider; model: string };
const optional = (provider: string | undefined, model: string | undefined): Role | null => {
  const p = asProvider(provider);
  return p ? { provider: p, model: model || DEFAULT_MODEL[p] } : null;
};
export function roles(env: Record<string, string | undefined> = process.env) {
  const graderProvider = asProvider(env.GRADER_PROVIDER) ?? 'anthropic';
  const grader: Role = { provider: graderProvider, model: env.GRADER_MODEL || DEFAULT_MODEL[graderProvider] };
  const readerProvider = asProvider(env.READER_PROVIDER);
  const reader: Role = readerProvider
    ? { provider: readerProvider, model: env.READER_MODEL || (readerProvider === graderProvider ? grader.model : DEFAULT_MODEL[readerProvider]) }
    : grader;
  const cross = optional(env.CROSS_READ_PROVIDER, env.CROSS_READ_MODEL);
  const escalate = optional(env.ESCALATE_PROVIDER, env.ESCALATE_MODEL);
  return { reader, grader, cross, escalate };
}

function make(role: Role, effort?: Effort): Reader {
  const opts = { effort, model: role.model };
  if (role.provider === 'openai') return createOpenAIReader(undefined, opts);
  if (role.provider === 'gemini') return createGeminiReader(undefined, opts);
  return createClaudeReader(undefined, opts);
}

// A second call is made only while a full one still fits in the queue's
// lease: a first call that failed or ended late (a timeout) plus a second one
// would outlive the lease, and another worker would read and pay for the same
// page meanwhile.
const SPARE_MARGIN_MS = 15_000;
const late = (started: number) => Date.now() - started + readerTimeoutMs() > LEASE_MS - SPARE_MARGIN_MS;
const say = (e: unknown) => (e instanceof Error ? e.message.slice(0, 200) : e);

// Try the main reader; on failure, the spare once. An answer cut off at the
// output limit is not passed on: the caller splits the work.
export function fallback<A extends unknown[], R>(main: (...a: A) => Promise<R>, spare: ((...a: A) => Promise<R>) | null, what: string) {
  if (!spare) return main;
  return async (...a: A): Promise<R> => {
    const started = Date.now();
    try {
      return await main(...a);
    } catch (e) {
      if (late(started) || e instanceof OutputTruncated) throw e;
      console.error(`[reader] ${what} failed, trying the spare`, say(e));
      return spare(...a);
    }
  };
}

// What makes a klasik reading worth a second look: an answer the reader
// marked unclear, a name it could not make out, or nothing readable at all.
export const unsure = (read: KlasikRead) =>
  read.unreadable || read.answers.some((a) => a.unclear) || (Boolean(read.studentName?.trim()) && read.nameConfidence === 'low');

const add = (a: Usage, b: Usage): Usage => ({ inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens });

// A cheap reader first, the stronger one only for the pages it was unsure
// of: their second reading replaces the first (still unclear where the
// stronger one is unsure too). If the first reader fails, the stronger one
// stands in; if the second look fails, the first reading stays as it is.
type ReadKlasik = Reader['readKlasik'];
export function secondLook(first: ReadKlasik, expert: ReadKlasik): ReadKlasik {
  return async (image, note) => {
    const started = Date.now();
    let out: Awaited<ReturnType<ReadKlasik>>;
    try {
      out = await first(image, note);
    } catch (e) {
      if (late(started) || e instanceof OutputTruncated) throw e;
      console.error('[reader] readKlasik failed, the stronger model stands in', say(e));
      return expert(image, note);
    }
    if (!unsure(out.read) || late(started)) return out;
    try {
      const again = await expert(image, note);
      return { read: again.read, usage: add(out.usage, again.usage) };
    } catch (e) {
      console.error('[reader] second look failed', say(e));
      return out;
    }
  };
}

export function createReader(opts: { effort?: Effort } = {}): Reader {
  const r = roles();
  const reader = make(r.reader, opts.effort);
  const grader = r.grader.provider === r.reader.provider && r.grader.model === r.reader.model ? reader : make(r.grader, opts.effort);
  const cross = r.cross ? make(r.cross, opts.effort) : null;
  const expert = r.escalate ? make(r.escalate, opts.effort) : null;
  // the spare is the other configured provider, never the same one twice
  const spareFor = (role: Role) => [r.grader, r.reader, r.cross].find((x) => x && x.provider !== role.provider) ?? null;
  const readSpare = spareFor(r.reader) ? make(spareFor(r.reader)!, opts.effort) : null;
  const gradeSpare = spareFor(r.grader) ? make(spareFor(r.grader)!, opts.effort) : null;
  const readKlasik = cross ? crossReadKlasik(reader, cross) : fallback(reader.readKlasik, readSpare?.readKlasik ?? null, 'readKlasik');
  const readKlasikKey = fallback(reader.readKlasikKey ?? reader.readKlasik, readSpare ? readSpare.readKlasikKey ?? readSpare.readKlasik : null, 'readKlasikKey');
  return {
    readKey: fallback(reader.readKey, readSpare?.readKey ?? null, 'readKey'),
    readStudent: fallback(reader.readStudent, readSpare?.readStudent ?? null, 'readStudent'),
    readKlasik: expert ? secondLook(readKlasik, expert.readKlasik) : readKlasik,
    readKlasikKey: expert ? secondLook(readKlasikKey, expert.readKlasikKey ?? expert.readKlasik) : readKlasikKey,
    ...(reader.readRoster ? { readRoster: fallback(reader.readRoster, readSpare?.readRoster ?? null, 'readRoster') } : {}),
    draftRubric: expert
      ? fallback(expert.draftRubric, grader.draftRubric, 'draftRubric')
      : fallback(grader.draftRubric, gradeSpare?.draftRubric ?? null, 'draftRubric'),
    // with no other provider, the stronger model grades what the grader could not
    gradeKlasik: fallback(grader.gradeKlasik, gradeSpare?.gradeKlasik ?? expert?.gradeKlasik ?? null, 'gradeKlasik'),
    ...(expert ? { expert } : {}),
  };
}

export const readerModel = () => roles().reader.model;
export const graderModelName = () => roles().grader.model;
