// Event storage + admin session helpers.
//
// Funnel events are rows in the Postgres `events` table on our own server,
// so they survive restarts without an external KV service.

import crypto from 'node:crypto';
import { desc } from 'drizzle-orm';
import { getDb, type Db } from '@/db/client';
import { events as eventsTable } from '@/db/schema';

const MAX_READ = 20_000;
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

// Events live in Postgres on our own server, so they always persist.
export const isPersistent = () => true;

export async function pushEvents(list: TrackEvent[], db: Db = getDb()) {
  if (!list.length) return;
  await db.insert(eventsTable).values(
    list.map((e) => ({ ...e, ts: new Date(e.ts) })),
  );
}

export async function readEvents(limit = MAX_READ, db: Db = getDb()): Promise<TrackEvent[]> {
  const rows = await db.select().from(eventsTable)
    .orderBy(desc(eventsTable.ts)).limit(Math.min(limit, MAX_READ));
  return rows.map(({ id: _id, ts, ...rest }) => ({ ...rest, ts: ts.toISOString() }));
}

export async function clearEvents(db: Db = getDb()) {
  await db.delete(eventsTable);
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
// Fixed window per IP. Single app process: an in-memory window is enough.
// The IP is only ever stored hashed, with a TTL.
const buckets = new Map<string, { count: number; resetAt: number }>();

export async function rateLimited(
  scope: string,
  req: Request,
  max: number,
  windowSec: number,
): Promise<boolean> {
  const id = crypto.createHash('sha256').update(clientIp(req)).digest('base64url').slice(0, 22);
  const key = `sinavoku:rl:${scope}:${id}`;

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
