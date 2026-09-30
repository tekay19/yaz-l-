// The test panel's only door to the backend: one function per endpoint in
// docs/api.md, and one place that turns an error response into the Turkish
// message the backend put in it. Nothing here throws; every call resolves
// to a result the screen can show.

import type { Rubric } from '@/lib/types';
import type { KlasikReview } from '@/lib/klasik/jobs';

export type { KlasikReview, ReviewQuestion, ReviewSheet } from '@/lib/klasik/jobs';
export type Fail = { ok: false; status: number; error: string; body: any };
export type Result<T> = { ok: true; data: T } | Fail;

export type Me = { email: string; pageBalance: number; klasik: boolean };
export type JobView = {
  id: string; title: string; mode: 'optik' | 'klasik'; status: string;
  pages: { key: number; students: number; read: number; failed: number };
  createdAt: string;
};
export type ReviewRow = {
  pageId: string; seq: number; student: string;
  correct: number; wrong: number; blank: number; score: number;
  flags: string[]; imageUrl: string;
};
export type Review = {
  roster: string[];
  key: { questionCount: number; answers: { q: number; option: string | null }[] };
  keyPageId: string | null;
  keyFlags: string[];
  rows: ReviewRow[];
  failed: { seq: number; reason: string }[];
};
export type Correction = { studentName?: string; answers?: { q: number; marked: string[] }[] };
export type RubricView = { status: string; keyText: string; rubric: Rubric | null; approved: boolean; problems: string[] };
export type KlasikCorrection = {
  studentName?: string;
  points?: { q: number; points: number | null }[];
  texts?: { q: number; text: string }[];
};

const withJson = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export function createApi(fetchImpl: typeof fetch = (input, init) => fetch(input, init)) {
  async function call<T>(url: string, init: RequestInit = {}): Promise<Result<T>> {
    let res: Response;
    try {
      res = await fetchImpl(url, { credentials: 'same-origin', cache: 'no-store', ...init });
    } catch {
      return { ok: false, status: 0, error: 'Sunucuya ulaşılamadı.', body: null };
    }
    const body = res.status === 204 ? null : await res.json().catch(() => null);
    if (res.ok) return { ok: true, data: body as T };
    const error = (typeof body?.message === 'string' && body.message)
      || (typeof body?.error === 'string' && body.error)
      || `İstek başarısız (${res.status}).`;
    return { ok: false, status: res.status, error, body };
  }
  const post = (url: string) => call<{ ok: true }>(url, { method: 'POST' });

  return {
    me: () => call<Me>('/api/me'),
    login: (email: string) => call<{ ok: true }>('/api/auth/login', withJson('POST', { email })),
    logout: () => call<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
    deleteAccount: () => call<null>('/api/me', { method: 'DELETE' }),
    checkout: (pack: string) => call<{ paymentPageUrl: string }>('/api/pay/checkout', withJson('POST', { pack })),
    createJob: (title: string, mode: 'optik' | 'klasik' = 'optik') => call<{ id: string }>('/api/jobs', withJson('POST', { title, mode })),
    listJobs: () => call<JobView[]>('/api/jobs'),
    job: (id: string) => call<JobView>(`/api/jobs/${id}`),
    uploadPage: (id: string, file: Blob, kind: 'key' | 'student') => {
      const form = new FormData();
      form.set('kind', kind);
      form.set('file', file);
      return call<{ id: string; seq: number }>(`/api/jobs/${id}/pages`, { method: 'POST', body: form });
    },
    removePage: (id: string, pageId: string) => call<null>(`/api/jobs/${id}/pages/${pageId}`, { method: 'DELETE' }),
    setRoster: (id: string, roster: string) => call<{ count: number }>(`/api/jobs/${id}/roster`, withJson('PUT', { roster })),
    submit: (id: string, noRoster = false) =>
      call<{ ok: true; reserved: number }>(`/api/jobs/${id}/submit`, withJson('POST', noRoster ? { consent: true, noRoster: true } : { consent: true })),
    review: (id: string) => call<Review>(`/api/jobs/${id}/review`),
    correct: (id: string, pageId: string, patch: Correction) => call<{ ok: true }>(`/api/jobs/${id}/pages/${pageId}`, withJson('PATCH', patch)),
    correctKey: (id: string, keyPageId: string, key: { q: number; option: string | null }[]) =>
      call<{ ok: true }>(`/api/jobs/${id}/pages/${keyPageId}`, withJson('PATCH', { key })),
    approve: (id: string) => post(`/api/jobs/${id}/approve`),
    // klasik
    setKeyText: (id: string, text: string) => call<{ ok: true }>(`/api/jobs/${id}/key-text`, withJson('PUT', { text })),
    rubric: (id: string) => call<RubricView>(`/api/jobs/${id}/rubric`),
    saveRubric: (id: string, rubric: Rubric) => call<{ rubric: Rubric }>(`/api/jobs/${id}/rubric`, withJson('PUT', rubric)),
    approveRubric: (id: string) => post(`/api/jobs/${id}/rubric/approve`),
    redraftRubric: (id: string) => post(`/api/jobs/${id}/rubric/redraft`),
    klasikReview: (id: string) => call<KlasikReview>(`/api/jobs/${id}/review`),
    correctKlasik: (id: string, pageId: string, patch: KlasikCorrection) =>
      call<{ ok: true }>(`/api/jobs/${id}/pages/${pageId}`, withJson('PATCH', patch)),
    acceptAnswer: (id: string, pageId: string, q: number, note: string) =>
      call<{ ok: true }>(`/api/jobs/${id}/rubric/accept`, withJson('POST', { pageId, q, note })),
    regrade: (id: string, pageId: string) => post(`/api/jobs/${id}/pages/${pageId}/regrade`),
  };
}

export type Api = ReturnType<typeof createApi>;
