// The browser's one way to call the backend. Nothing here throws: every call
// resolves to data or to a Turkish message the screen can show (the one the
// backend put in `message` or `error`, else a generic one).

export type Fail = { ok: false; status: number; error: string; body: any };
export type Result<T> = { ok: true; data: T } | Fail;

export const ADMIN_SESSION_LOST = 'Yönetici oturumu kapanmış. /panel sayfasından yeniden giriş yapın.';

export const withJson = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export async function request<T>(
  url: string,
  init: RequestInit = {},
  opts: { fetch?: typeof fetch; unauthorized?: string; failed?: string } = {},
): Promise<Result<T>> {
  const doFetch = opts.fetch ?? ((input: RequestInfo | URL, i?: RequestInit) => fetch(input, i));
  let res: Response;
  try {
    res = await doFetch(url, { credentials: 'same-origin', cache: 'no-store', ...init });
  } catch {
    return { ok: false, status: 0, error: 'Sunucuya ulaşılamadı.', body: null };
  }
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.ok) return { ok: true, data: body as T };
  if (res.status === 401 && opts.unauthorized) return { ok: false, status: 401, error: opts.unauthorized, body };
  const error = (typeof body?.message === 'string' && body.message)
    || (typeof body?.error === 'string' && body.error)
    || `${opts.failed ?? 'İstek başarısız'} (${res.status}).`;
  return { ok: false, status: res.status, error, body };
}

// Whether the panel's admin session is open.
export async function adminSignedIn(doFetch?: typeof fetch): Promise<boolean> {
  const r = await request<{ authed?: boolean }>('/api/admin?action=session', {}, { fetch: doFetch });
  return r.ok && Boolean(r.data?.authed);
}
