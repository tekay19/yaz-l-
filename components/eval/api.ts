// The measurement screen's door to the backend: the admin session check the
// panel already uses, and /api/admin/eval, which reads one photo per call.
// Nothing here throws; every call resolves to something the screen can show.

import type { KeyRead, StudentRead } from '@/lib/types';
import type { Effort, Usage } from '@/lib/reader/claude';
import type { Label } from './labels';

export type EvalRead = { read: KeyRead | StudentRead; usage: Usage; ms: number; model: string; effort: Effort };
export type EvalResult = { ok: true; data: EvalRead } | { ok: false; status: number; error: string };

export function createEvalApi(fetchImpl: typeof fetch = (input, init) => fetch(input, init)) {
  const opts = { credentials: 'same-origin', cache: 'no-store' } as const;
  return {
    async signedIn(): Promise<boolean> {
      try {
        const res = await fetchImpl('/api/admin?action=session', opts);
        return Boolean((await res.json().catch(() => null))?.authed);
      } catch {
        return false;
      }
    },

    async read(file: Blob, label: Label, effort: Effort): Promise<EvalResult> {
      const form = new FormData();
      form.set('file', file);
      form.set('kind', label.kind);
      form.set('questionCount', String(label.questionCount));
      form.set('effort', effort);
      let res: Response;
      try {
        res = await fetchImpl('/api/admin/eval', { ...opts, method: 'POST', body: form });
      } catch {
        return { ok: false, status: 0, error: 'Sunucuya ulaşılamadı.' };
      }
      const body = await res.json().catch(() => null);
      if (res.ok) return { ok: true, data: body as EvalRead };
      if (res.status === 401) {
        return { ok: false, status: 401, error: 'Yönetici oturumu kapanmış. /panel sayfasından yeniden giriş yapın.' };
      }
      const error = (typeof body?.error === 'string' && body.error) || `Okuma başarısız (${res.status}).`;
      return { ok: false, status: res.status, error };
    },
  };
}

export type EvalApi = ReturnType<typeof createEvalApi>;
