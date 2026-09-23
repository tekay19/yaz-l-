// Event storage + admin session helpers.
//
// Events go to an Upstash-compatible Redis REST API (Upstash, Vercel KV, or a
// self-hosted equivalent) over plain fetch, so the app needs no extra
// dependency. Without one configured, events are kept in the running
// process's memory and the panel says so rather than showing numbers that
// silently lost data.

import crypto from 'node:crypto';

const KV_URL = process.env.KV_REST_API_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || '';

const EVENT_KEY = 'sinavoku:events';
const MAX_EVENTS = 20_000; // ring buffer
const SESSION_TTL = 8 * 3600; // seconds — one working day
export const COOKIE = 'so_admin';

export type TrackEvent = {
  ts: string;
  event: string;
  page: string;
  label: string;
  value: number | null;
  visitor: string;
  session: string;
  ref: string;
  utm: string;
  vw: number | null;
  ua: string;
};

export const hasKV = () => Boolean(KV_URL && KV_TOKEN);

// module-scope fallback; survives between requests in one process
const memory: TrackEvent[] = [];

async function kv<T = unknown>(command: (string | number)[]): Promise<T> {
  const res = await fetch(KV_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`kv_${res.status}`);
  const json = (await res.json()) as { result: T };
  return json.result;
}

export async function pushEvents(events: TrackEvent[]) {
  if (!events.length) return;
  if (!hasKV()) {
    memory.push(...events);
    if (memory.length > MAX_EVENTS) memory.splice(0, memory.length - MAX_EVENTS);
    return;
  }
  await kv(['LPUSH', EVENT_KEY, ...events.map((e) => JSON.stringify(e))]);
  await kv(['LTRIM', EVENT_KEY, 0, MAX_EVENTS - 1]);
}

export async function readEvents(limit = MAX_EVENTS): Promise<TrackEvent[]> {
  const n = Math.min(limit, MAX_EVENTS);
  if (!hasKV()) return memory.slice(-n).reverse();
  const rows = await kv<string[]>(['LRANGE', EVENT_KEY, 0, n - 1]);
  return (rows || [])
    .map((r) => {
      try {
        return JSON.parse(r) as TrackEvent;
      } catch {
        return null;
      }
    })
    .filter((e): e is TrackEvent => Boolean(e));
}

export async function clearEvents() {
  if (!hasKV()) {
    memory.length = 0;
    return;
  }
  await kv(['DEL', EVENT_KEY]);
}

// ── Session cookie ───────────────────────────────────────────────────────
// Format: <expiry>.<hmac>. Stateless and signed with ADMIN_SECRET, so a
// stolen cookie expires on its own and no session store is needed.

function secret(): string | null {
  const s = process.env.ADMIN_SECRET || '';
  return s.length >= 16 ? s : null;
}

const sign = (value: string, key: string) =>
  crypto.createHmac('sha256', key).update(value).digest('base64url');

export function issueToken(): string | null {
  const key = secret();
  if (!key) return null;
  const exp = String(Math.floor(Date.now() / 1000) + SESSION_TTL);
  return `${exp}.${sign(exp, key)}`;
}

export function verifyToken(token: string | undefined): boolean {
  const key = secret();
  if (!key || !token) return false;
  const dot = token.indexOf('.');
  if (dot < 1) return false;
  const exp = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  if (!/^\d+$/.test(exp)) return false;
  if (Number(exp) * 1000 < Date.now()) return false;
  const a = Buffer.from(mac);
  const b = Buffer.from(sign(exp, key));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const sessionCookie = (token: string) => ({
  name: COOKIE,
  value: token,
  // HttpOnly: unreadable from JS, so an XSS on the panel cannot lift it.
  // SameSite=strict: never sent cross-site, which is also the CSRF defence.
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_TTL,
});

// Constant-time password check. Both sides are hashed first so the compare
// runs over equal-length buffers whatever was attempted.
export function passwordMatches(attempt: string): boolean {
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected) return false;
  const h = (v: string) => crypto.createHash('sha256').update(v).digest();
  return crypto.timingSafeEqual(h(attempt), h(expected));
}

// ── Login throttle ───────────────────────────────────────────────────────
// Per-process and best effort: enough to stop password guessing at speed.
const attempts = new Map<string, { first: number; count: number }>();
const WINDOW = 15 * 60 * 1000;
const MAX_TRIES = 8;

export function tooManyAttempts(ip: string): boolean {
  const rec = attempts.get(ip);
  if (!rec || Date.now() - rec.first > WINDOW) return false;
  return rec.count >= MAX_TRIES;
}

export function noteAttempt(ip: string, ok: boolean) {
  if (ok) {
    attempts.delete(ip);
    return;
  }
  const rec = attempts.get(ip);
  if (!rec || Date.now() - rec.first > WINDOW) attempts.set(ip, { first: Date.now(), count: 1 });
  else rec.count += 1;
}

// ── Public endpoint rate limit ───────────────────────────────────────────
// Fixed window per IP. With KV the counter is shared by every instance, so
// spam cannot flush real events out of the ring buffer; without KV it falls
// back to per-process memory. The IP is only ever stored hashed, with a TTL.
const buckets = new Map<string, { count: number; resetAt: number }>();

export async function rateLimited(
  scope: string,
  req: Request,
  max: number,
  windowSec: number,
): Promise<boolean> {
  const id = crypto.createHash('sha256').update(clientIp(req)).digest('base64url').slice(0, 22);
  const key = `sinavoku:rl:${scope}:${id}`;

  if (hasKV()) {
    try {
      const count = await kv<number>(['INCR', key]);
      if (count === 1) await kv(['EXPIRE', key, windowSec]);
      return count > max;
    } catch {
      // fall through to the in-memory limiter if KV is unreachable
    }
  }

  const now = Date.now();
  const rec = buckets.get(key);
  if (!rec || rec.resetAt <= now) {
    if (buckets.size > 10_000) buckets.clear();
    buckets.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return false;
  }
  rec.count += 1;
  return rec.count > max;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') || '';
  return fwd.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}
