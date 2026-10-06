// The measurement screen's door to the backend: the admin session check the
// panel already uses, and /api/admin/eval, which reads one photo per call.
// Nothing here throws; every call resolves to something the screen can show.

import type { KeyRead, StudentRead } from '@/lib/types';
import type { Effort, Usage } from '@/lib/reader/types';
import type { Label } from './labels';
import { ADMIN_SESSION_LOST, adminSignedIn, request } from '@/lib/client/request';

export type EvalRead = { read: KeyRead | StudentRead; usage: Usage; ms: number; model: string; effort: Effort };
export type EvalResult = { ok: true; data: EvalRead } | { ok: false; status: number; error: string };

export function createEvalApi(fetchImpl: typeof fetch = (input, init) => fetch(input, init)) {
  return {
    signedIn: (): Promise<boolean> => adminSignedIn(fetchImpl),

    async read(file: Blob, label: Label, effort: Effort): Promise<EvalResult> {
      const form = new FormData();
      form.set('file', file);
      form.set('kind', label.kind);
      form.set('questionCount', String(label.questionCount));
      form.set('effort', effort);
      const r = await request<EvalRead>('/api/admin/eval', { method: 'POST', body: form },
        { fetch: fetchImpl, unauthorized: ADMIN_SESSION_LOST, failed: 'Okuma başarısız' });
      return r.ok ? r : { ok: false, status: r.status, error: r.error };
    },
  };
}

export type EvalApi = ReturnType<typeof createEvalApi>;
