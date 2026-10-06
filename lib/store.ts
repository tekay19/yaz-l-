// Event storage, the sign-in throttle and the public rate limit.
//
// Funnel events are rows in the Postgres `events` table on our own server,
// so they survive restarts without an external KV service.

import crypto from 'node:crypto';
import { desc } from 'drizzle-orm';
import { getDb, type Db } from '@/db/client';
import { events as eventsTable } from '@/db/schema';

const MAX_READ = 20_000;

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

// ── Login throttle ───────────────────────────────────────────────────────
// Per-process and best effort: enough to stop password guessing at speed.
// Keyed by whatever the caller names: an IP, an e-mail address.
const attempts = new Map<string, { first: number; count: number }>();
const WINDOW = 15 * 60 * 1000;
const MAX_TRIES = 8;

export function tooManyAttempts(key: string): boolean {
  const rec = attempts.get(key);
  if (!rec || Date.now() - rec.first > WINDOW) return false;
  return rec.count >= MAX_TRIES;
}

export function noteAttempt(key: string, ok: boolean) {
  if (ok) {
    attempts.delete(key);
    return;
  }
  const rec = attempts.get(key);
  if (!rec || Date.now() - rec.first > WINDOW) {
    if (attempts.size > 10_000) attempts.clear();
    attempts.set(key, { first: Date.now(), count: 1 });
  }
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
