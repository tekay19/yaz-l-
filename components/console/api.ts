// The test panel's only door to the backend: one function per endpoint in
// docs/api.md, and one place that turns an error response into the Turkish
// message the backend put in it. Nothing here throws; every call resolves
// to a result the screen can show.

import type { Rubric } from '@/lib/types';
import type { KlasikReview } from '@/lib/klasik/jobs';
import type { ClassView, HistoryEntry } from '@/lib/account';
import type { ExamResults } from '@/lib/jobs/results';
import type { GradingStyle } from '@/lib/types';

export type { KlasikReview, ReviewQuestion, ReviewSheet } from '@/lib/klasik/jobs';
import { request, withJson, type Result } from '@/lib/client/request';

export type { Fail, Result } from '@/lib/client/request';

export type { ClassView, HistoryEntry } from '@/lib/account';
export type { ExamResults } from '@/lib/jobs/results';
export type Settings = { style?: GradingStyle; note?: string };
export type Me = {
  email: string; name: string; role: 'teacher' | 'admin'; verified: boolean;
  pageBalance: number; klasik: boolean; settings: Settings;
};
export type JobView = {
  id: string; title: string; mode: 'optik' | 'klasik'; status: string;
  pages: { key: number; students: number; read: number; failed: number; graded: number };
  rubricApproved: boolean;
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
// a draft as the upload wizard needs it back: photos in order, roster, typed key
export type Draft = {
  id: string; title: string; mode: 'optik' | 'klasik'; status: string;
  roster: string[]; keyText: string; teacherNote: string;
  pages: { id: string; kind: 'key' | 'student'; seq: number }[];
};
export type RubricView = { status: string; keyText: string; rubric: Rubric | null; approved: boolean; problems: string[] };
export type KlasikCorrection = {
  studentName?: string;
  points?: { q: number; points: number | null }[];
  texts?: { q: number; text: string }[];
};

export function createApi(fetchImpl: typeof fetch = (input, init) => fetch(input, init)) {
  const call = <T,>(url: string, init: RequestInit = {}): Promise<Result<T>> => request<T>(url, init, { fetch: fetchImpl });
  const post = (url: string) => call<{ ok: true }>(url, { method: 'POST' });

  return {
    me: () => call<Me>('/api/me'),
    login: (email: string, password: string) =>
      call<{ ok: true; role: Me['role'] }>('/api/auth/login', withJson('POST', { email, password })),
    register: (name: string, email: string, password: string) =>
      call<{ ok: true; role: Me['role'] }>('/api/auth/register', withJson('POST', { name, email, password })),
    forgot: (email: string) => call<{ ok: true }>('/api/auth/forgot', withJson('POST', { email })),
    reset: (token: string, password: string) =>
      call<{ ok: true; role: Me['role'] }>('/api/auth/reset', withJson('POST', { token, password })),
    verify: (token: string) => call<{ ok: true }>('/api/auth/verify', withJson('POST', { token })),
    resendVerification: () => call<{ ok: true }>('/api/auth/verify/resend', { method: 'POST' }),
    changePassword: (current: string, next: string) =>
      call<{ ok: true }>('/api/me/password', withJson('POST', { current, next })),
    logout: () => call<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
    deleteAccount: () => call<null>('/api/me', { method: 'DELETE' }),
    checkout: (pack: string) => call<{ paymentPageUrl: string }>('/api/pay/checkout', withJson('POST', { pack })),
    createJob: (title: string, mode: 'optik' | 'klasik' = 'optik') => call<{ id: string }>('/api/jobs', withJson('POST', { title, mode })),
    listJobs: () => call<JobView[]>('/api/jobs'),
    job: (id: string) => call<JobView>(`/api/jobs/${id}`),
    draft: (id: string) => call<Draft>(`/api/jobs/${id}/pages`),
    uploadPage: (id: string, file: Blob, kind: 'key' | 'student') => {
      const form = new FormData();
      form.set('kind', kind);
      form.set('file', file);
      return call<{ id: string; seq: number }>(`/api/jobs/${id}/pages`, { method: 'POST', body: form });
    },
    removePage: (id: string, pageId: string) => call<null>(`/api/jobs/${id}/pages/${pageId}`, { method: 'DELETE' }),
    deleteJob: (id: string) => call<null>(`/api/jobs/${id}`, { method: 'DELETE' }),
    readRosterPhoto: (file: Blob) => {
      const form = new FormData();
      form.set('file', file);
      return call<{ names: string[] }>('/api/roster/photo', { method: 'POST', body: form });
    },
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
    setNote: (id: string, note: string) => call<{ ok: true }>(`/api/jobs/${id}/note`, withJson('PUT', { note })),
    rubric: (id: string) => call<RubricView>(`/api/jobs/${id}/rubric`),
    saveRubric: (id: string, rubric: Rubric) => call<{ rubric: Rubric }>(`/api/jobs/${id}/rubric`, withJson('PUT', rubric)),
    approveRubric: (id: string) => post(`/api/jobs/${id}/rubric/approve`),
    redraftRubric: (id: string) => post(`/api/jobs/${id}/rubric/redraft`),
    klasikReview: (id: string) => call<KlasikReview>(`/api/jobs/${id}/review`),
    correctKlasik: (id: string, pageId: string, patch: KlasikCorrection) =>
      call<{ ok: true }>(`/api/jobs/${id}/pages/${pageId}`, withJson('PATCH', patch)),
    acceptAnswer: (id: string, pageId: string, q: number, note: string) =>
      call<{ ok: true }>(`/api/jobs/${id}/rubric/accept`, withJson('POST', { pageId, q, note })),
    followTeacher: (id: string, q: number) =>
      call<{ examples: number; regrading: number; style: 'strict' | 'balanced' | 'lenient' | null }>(`/api/jobs/${id}/rubric/scored`, withJson('POST', { q })),
    regrade: (id: string, pageId: string) => post(`/api/jobs/${id}/pages/${pageId}/regrade`),
    // the teacher's panel
    results: (id: string) => call<ExamResults>(`/api/jobs/${id}/results`),
    reportUrl: (id: string, format: 'xlsx' | 'pdf') => `/api/jobs/${id}/report${format === 'pdf' ? '?format=pdf' : ''}`,
    history: () => call<HistoryEntry[]>('/api/me/history'),
    saveSettings: (s: Settings) => call<Settings>('/api/me/settings', withJson('PUT', s)),
    classes: () => call<ClassView[]>('/api/classes'),
    createClass: (name: string, students: string) => call<ClassView>('/api/classes', withJson('POST', { name, students })),
    updateClass: (id: string, patch: { name?: string; students?: string }) => call<ClassView>(`/api/classes/${id}`, withJson('PUT', patch)),
    deleteClass: (id: string) => call<null>(`/api/classes/${id}`, { method: 'DELETE' }),
  };
}

export type Api = ReturnType<typeof createApi>;
