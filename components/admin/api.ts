// Typed shapes and calls for /api/admin/*. Every call resolves to a Result.

import { request, withJson } from '@/lib/client/request';

export type Paged<T> = { rows: T[]; total: number; page: number; size: number };

export type Money = { kurus: number; payments: number };
export type Overview = {
  revenue: { today: Money; d7: Money; d30: Money };
  signups: { today: number; d7: number; d30: number };
  users: { total: number; verified: number; suspended: number; paying: number; outstandingPages: number };
  pages30: { read: number; failed: number; inputTokens: number; outputTokens: number };
  jobs: { byStatus: Record<string, number>; open: number; stuck: number; failed30: number };
  series: { day: string; revenueKurus: number; signups: number; jobs: number }[];
};

export type UserRow = {
  id: string; email: string; name: string; role: string; verified: boolean; suspended: boolean;
  pageBalance: number; createdAt: string; lastLoginAt: string | null; hasPassword: boolean; paidKurus: number; jobs: number;
};

export type AuditRow = {
  id: string; adminEmail: string; action: string; targetType: string; targetId: string;
  detail: Record<string, unknown> | null; createdAt: string;
};

export type UserJob = {
  id: string; title: string; mode: string; status: string; reservedPages: number;
  createdAt: string; submittedAt: string | null; finishedAt: string | null; failReason: string | null;
};
export type PaymentRow = {
  id: string; pack: string; pages: number; amountKurus: number; status: string; createdAt: string; paidAt: string | null;
};
export type LedgerRow = { id: string; delta: number; reason: string; ref: string | null; createdAt: string };

export type UserDetail = {
  user: {
    id: string; email: string; name: string; role: string; emailVerifiedAt: string | null; suspendedAt: string | null;
    pageBalance: number; createdAt: string; lastLoginAt: string | null; hasPassword: boolean; paidKurus: number;
  };
  jobs: UserJob[];
  payments: PaymentRow[];
  ledger: LedgerRow[];
  classes: number;
  actions: AuditRow[];
};

export type JobRow = {
  id: string; title: string; mode: string; status: string; failReason: string | null; reservedPages: number;
  createdAt: string; submittedAt: string | null; finishedAt: string | null; userId: string; email: string;
  pages: number; readPages: number; failedPages: number;
};

export type JobDetail = {
  job: {
    id: string; title: string; mode: string; status: string; failReason: string | null; reservedPages: number; rosterSize: number;
    createdAt: string; submittedAt: string | null; finishedAt: string | null; notifiedAt: string | null;
    rubricApprovedAt: string | null; autoDeliveredAt: string | null; userId: string; email: string;
  };
  pages: {
    id: string; kind: string; seq: number; status: string; attempts: number; error: string | null;
    inputTokens: number | null; outputTokens: number | null; hasPhoto: boolean; graded: boolean;
  }[];
  refunded: number;
  actions: AuditRow[];
};

export type AdminPaymentRow = PaymentRow & { hasToken: boolean; userId: string | null; email: string | null };

type Named = { name: string; count: number };
export type Analytics = {
  range: string;
  totals: Record<'events' | 'visitors' | 'sessions' | 'page_view' | 'scroll_depth' | 'cta_click' | 'pack_click' | 'card_start' | 'buy_submit' | 'error_view' | 'waitlist_submit' | 'exit' | 'lead', number>;
  pageViews: Named[];
  funnel: { key: string; label: string; sessions: number; share: number }[];
  ctas: Named[];
  packs: Named[];
  referrers: Named[];
  byDay: Named[];
  devices: { mobile: number; desktop: number };
  avgScroll: { name: string; value: number }[];
  avgSeconds: { name: string; value: number }[];
  leads: { email: string; source: string; ts: string }[];
  recent: { ts: string; event: string; page: string; label: string; value: number | null }[];
};

export const qs = (params: Record<string, string | number | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '' && v !== 'all') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const adminUrl = {
  overview: () => '/api/admin/overview',
  users: (q: Record<string, string | number | null>) => `/api/admin/users${qs(q)}`,
  user: (id: string) => `/api/admin/users/${encodeURIComponent(id)}`,
  jobs: (q: Record<string, string | number | null>) => `/api/admin/jobs${qs(q)}`,
  job: (id: string) => `/api/admin/jobs/${encodeURIComponent(id)}`,
  payments: (q: Record<string, string | number | null>) => `/api/admin/payments${qs(q)}`,
  analytics: (range: string) => `/api/admin/analytics?range=${encodeURIComponent(range)}`,
  audit: (page: number) => `/api/admin/audit${qs({ sayfa: page > 1 ? page : null })}`,
};

export const userAction = (id: string, body: Record<string, unknown>) =>
  request<{ ok: true; balance?: number }>(adminUrl.user(id), withJson('POST', body));
export const closeJob = (id: string, note: string) =>
  request<{ ok: true }>(adminUrl.job(id), withJson('POST', { action: 'close', note }));
export const reconcilePayment = (id: string) =>
  request<{ ok: true; result: 'paid' | 'failed' | 'unknown' }>(`/api/admin/payments/${encodeURIComponent(id)}`, withJson('POST', { action: 'reconcile' }));
export const clearAnalytics = () => request<{ ok: true }>('/api/admin/analytics', { method: 'DELETE' });
export const logout = () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' });
