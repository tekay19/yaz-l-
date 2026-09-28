import { describe, expect, it } from 'vitest';
import { createApi } from '@/components/console/api';
import { flaggedQuestions, nameFlagged } from '@/components/console/flags';

type Call = { url: string; method: string; body: unknown };

// A fetch that records what the panel sends and answers with a canned response.
function recorder(status = 200, payload: unknown = {}) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init: RequestInit = {}) => {
    const body = init.body instanceof FormData
      ? Object.fromEntries([...init.body.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : 'file']))
      : init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method: init.method ?? 'GET', body });
    return new Response(status === 204 ? null : JSON.stringify(payload), { status });
  }) as unknown as typeof fetch;
  return { calls, api: createApi(fetchImpl) };
}

// The panel is only useful if every call hits the endpoint docs/api.md
// describes; a wrong path or method fails silently as a 404 on screen.
describe('console api contract', () => {
  const J = 'job-1';
  const P = 'page-1';
  it.each([
    ['me', (a: any) => a.me(), 'GET', '/api/me', undefined],
    ['login', (a: any) => a.login('a@b.co'), 'POST', '/api/auth/login', { email: 'a@b.co' }],
    ['logout', (a: any) => a.logout(), 'POST', '/api/auth/logout', undefined],
    ['deleteAccount', (a: any) => a.deleteAccount(), 'DELETE', '/api/me', undefined],
    ['checkout', (a: any) => a.checkout('Başlangıç'), 'POST', '/api/pay/checkout', { pack: 'Başlangıç' }],
    ['createJob', (a: any) => a.createJob('9-B'), 'POST', '/api/jobs', { title: '9-B', mode: 'optik' }],
    ['listJobs', (a: any) => a.listJobs(), 'GET', '/api/jobs', undefined],
    ['job', (a: any) => a.job(J), 'GET', `/api/jobs/${J}`, undefined],
    ['uploadPage', (a: any) => a.uploadPage(J, new Blob(['x']), 'key'), 'POST', `/api/jobs/${J}/pages`, { kind: 'key', file: 'file' }],
    ['removePage', (a: any) => a.removePage(J, P), 'DELETE', `/api/jobs/${J}/pages/${P}`, undefined],
    ['setRoster', (a: any) => a.setRoster(J, 'Elif\nMert'), 'PUT', `/api/jobs/${J}/roster`, { roster: 'Elif\nMert' }],
    ['submit', (a: any) => a.submit(J), 'POST', `/api/jobs/${J}/submit`, { consent: true }],
    ['submit without roster', (a: any) => a.submit(J, true), 'POST', `/api/jobs/${J}/submit`, { consent: true, noRoster: true }],
    ['review', (a: any) => a.review(J), 'GET', `/api/jobs/${J}/review`, undefined],
    ['correct', (a: any) => a.correct(J, P, { studentName: 'Elif', answers: [{ q: 2, marked: ['B'] }] }), 'PATCH', `/api/jobs/${J}/pages/${P}`, { studentName: 'Elif', answers: [{ q: 2, marked: ['B'] }] }],
    ['approve', (a: any) => a.approve(J), 'POST', `/api/jobs/${J}/approve`, undefined],
  ])('%s → %s %s', async (_name, invoke, method, url, body) => {
    const { calls, api } = recorder();
    await invoke(api);
    expect(calls).toEqual([{ url, method, body }]);
  });
});

describe('console api errors', () => {
  it('prefers the Turkish message over the error code (submit answers both)', async () => {
    const { api } = recorder(402, { ok: false, error: 'insufficient', need: 3, have: 1, message: 'Sayfa hakkınız yetmiyor.' });
    const r = await api.submit('j');
    expect(r).toMatchObject({ ok: false, status: 402, error: 'Sayfa hakkınız yetmiyor.' });
    expect(!r.ok && r.body.need).toBe(3);
  });
  it('uses the error text when there is no message', async () => {
    const { api } = recorder(401, { error: 'Giriş yapmanız gerekiyor.' });
    expect(await api.me()).toMatchObject({ ok: false, status: 401, error: 'Giriş yapmanız gerekiyor.' });
  });
  it('falls back to the status when the body is not JSON', async () => {
    const fetchImpl = (async () => new Response('<html>oops</html>', { status: 500 })) as unknown as typeof fetch;
    expect(await createApi(fetchImpl).me()).toMatchObject({ ok: false, status: 500, error: 'İstek başarısız (500).' });
  });
  it('reports an unreachable server instead of throwing', async () => {
    const fetchImpl = (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
    expect(await createApi(fetchImpl).me()).toMatchObject({ ok: false, status: 0, error: 'Sunucuya ulaşılamadı.' });
  });
  it('treats 204 No Content as success', async () => {
    const { api } = recorder(204);
    expect(await api.deleteAccount()).toEqual({ ok: true, data: null });
  });
});

// The review screen offers correction controls only for what the report
// flagged; the flags come back as the report's Turkish sentences.
describe('review flags', () => {
  it('finds the question numbers and the name problems in the flags', () => {
    const flags = ['İsim okunamadı', '2. soru net okunamadı', '12. soruda birden fazla işaret'];
    expect(flaggedQuestions(flags)).toEqual([2, 12]);
    expect(nameFlagged(flags)).toBe(true);
    expect(nameFlagged(['3. soru net okunamadı'])).toBe(false);
  });
});
