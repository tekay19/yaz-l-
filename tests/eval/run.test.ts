import { describe, expect, it } from 'vitest';
import { createEvalApi } from '@/components/eval/api';
import { failed, parseQuick, report, score, tally } from '@/components/eval/run';
import type { KeyLabel, StudentLabel } from '@/components/eval/labels';

const keyLabel: KeyLabel = { kind: 'key', questionCount: 2, answers: { 1: 'A', 2: 'blank' }, done: true };
const adaLabel: StudentLabel = { kind: 'student', questionCount: 2, name: 'Ada Yılmaz', marks: { 1: ['B'] }, done: true };
const usage = { inputTokens: 1000, outputTokens: 200 };
const meta = { usage, model: 'claude-opus-5', effort: 'medium' as const };

const keyRun = () => score('anahtar.jpg', keyLabel, {
  ...meta, ms: 900, read: { questionCount: 2, answers: [{ q: 1, option: 'C' }, { q: 2, option: null }] },
});
const adaRun = () => score('ada.jpg', adaLabel, {
  ...meta, ms: 1100,
  read: {
    isBackSide: false, studentName: 'ada yılmaz', nameConfidence: 'high', unreadable: false,
    answers: [{ q: 1, marked: ['B'], confidence: 'high' }, { q: 2, marked: [], confidence: 'high' }],
  },
});

describe('scoring a reading against its label', () => {
  it('scores a key sheet', () => {
    expect(keyRun()).toMatchObject({
      ok: true, file: 'anahtar.jpg', kind: 'key', model: 'claude-opus-5',
      result: { questions: 2, silentWrong: 1, mistakes: [{ q: 1, want: 'A', got: 'C' }] },
    });
  });
  it('scores a student sheet', () => {
    expect(adaRun()).toMatchObject({ ok: true, kind: 'student', result: { questions: 2, silentWrong: 0, name: 'ok' } });
  });
  it('adds up only the sheets that were read, and counts the ones that were not', () => {
    const t = tally([keyRun(), failed('b.jpg', adaLabel, 'Model bu fotoğrafı okumayı reddetti.'), adaRun()]);
    expect(t).toMatchObject({ failed: 1, keys: 1, students: 1 });
    expect(t.totals).toMatchObject({ pages: 2, questions: 4, silentWrong: 1, tokensIn: 2000, ms: 2000 });
  });
  it('reports the settings, the verdicts and every sheet, failed ones included', () => {
    const runs = [keyRun(), failed('b.jpg', adaLabel, 'reddetti')];
    const r = report(runs, { // model and effort come from the readings, not from the form
      at: '2026-09-24T10:00:00.000Z', prices: { inPerM: 5, outPerM: 25 },
      gate: { tryPerUsd: null, pagePriceTry: 1 / 3, concurrency: 4 },
    });
    expect(r).toMatchObject({ at: '2026-09-24T10:00:00.000Z', model: 'claude-opus-5', effort: 'medium', failed: 1 });
    expect(r.criteria.map((c) => c.key)).toEqual(['silentWrongRate', 'flaggedRate', 'nameAccuracy', 'costTry', 'classSeconds']);
    expect(r.sheets).toHaveLength(2);
  });
});

// Clicking 20 answers on 40 sheets is slow; the admin can type a row instead.
describe('quick entry', () => {
  it('reads one token per question: letters are marks, a dash is blank', () => {
    expect(parseQuick('a  BC,- e', 'student', 5)).toEqual({ ok: true, marks: { 1: ['A'], 2: ['B', 'C'], 3: [], 4: ['E'] } });
  });
  it('allows one choice per key question', () => {
    expect(parseQuick('A - C', 'key', 3)).toEqual({ ok: true, marks: { 1: ['A'], 2: [], 3: ['C'] } });
    expect(parseQuick('A BC', 'key', 3)).toEqual({ ok: false, error: '2. soru: anahtarda tek şık olur ("BC").' });
  });
  it('refuses what it cannot read rather than guessing', () => {
    expect(parseQuick('A F', 'student', 3)).toEqual({ ok: false, error: '2. soru: "F" okunamadı. A–E ya da boş için - yazın.' });
    expect(parseQuick('A B C D', 'student', 3)).toEqual({ ok: false, error: '3 soru var, 4 cevap yazıldı.' });
  });
});

type Call = { url: string; method: string; body: unknown };
function recorder(status = 200, payload: unknown = {}) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init: RequestInit = {}) => {
    const body = init.body instanceof FormData
      ? Object.fromEntries([...init.body.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : 'file']))
      : undefined;
    calls.push({ url, method: init.method ?? 'GET', body });
    return new Response(JSON.stringify(payload), { status });
  }) as unknown as typeof fetch;
  return { calls, api: createEvalApi(fetchImpl) };
}

describe('eval api', () => {
  it('sends the photo with the label kind, its question count and the chosen effort', async () => {
    const { calls, api } = recorder(200, { read: {}, usage, ms: 1, model: 'm', effort: 'low' });
    const r = await api.read(new Blob(['x']), adaLabel, 'low');
    expect(calls).toEqual([{ url: '/api/admin/eval', method: 'POST', body: { file: 'file', kind: 'student', questionCount: '2', effort: 'low' } }]);
    expect(r.ok).toBe(true);
  });
  it('asks the panel whether the admin is signed in', async () => {
    const { calls, api } = recorder(200, { authed: true });
    expect(await api.signedIn()).toBe(true);
    expect(calls[0]).toMatchObject({ url: '/api/admin?action=session', method: 'GET' });
    expect(await recorder(200, {}).api.signedIn()).toBe(false);
  });
  it('turns failures into something the admin can act on', async () => {
    const gone = await recorder(401, { error: 'unauthorized' }).api.read(new Blob(['x']), adaLabel, 'low');
    expect(gone).toEqual({ ok: false, status: 401, error: 'Yönetici oturumu kapanmış. /panel sayfasından yeniden giriş yapın.' });
    const refused = await recorder(502, { error: 'Model bu fotoğrafı okumayı reddetti.' }).api.read(new Blob(['x']), adaLabel, 'low');
    expect(refused).toEqual({ ok: false, status: 502, error: 'Model bu fotoğrafı okumayı reddetti.' });
    const down = await createEvalApi((async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch)
      .read(new Blob(['x']), adaLabel, 'low');
    expect(down).toEqual({ ok: false, status: 0, error: 'Sunucuya ulaşılamadı.' });
  });
});
