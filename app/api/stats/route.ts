// Aggregated funnel metrics for the admin panel. Requires a valid session
// cookie — without one it answers 401 and reveals nothing about the data.

import { cookies } from 'next/headers';
import { COOKIE, clearEvents, hasKV, readEvents, verifyToken, type TrackEvent } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FUNNEL = [
  { key: 'index', label: 'Vitrin' },
  { key: 'yukle', label: 'Yükleme' },
  { key: 'ozet', label: 'Özet' },
  { key: 'odeme', label: 'Sipariş' },
  { key: 'hata', label: 'Kapasite / sıraya girme' },
];

const RANGES: Record<string, number> = { '24h': 1, '7d': 7, '30d': 30, all: 0 };

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

async function authed() {
  const jar = await cookies();
  return verifyToken(jar.get(COOKIE)?.value);
}

function bump(map: Map<string, number>, key: string) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}
const toSorted = (map: Map<string, number>, limit = 50) =>
  Array.from(map, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

export async function DELETE() {
  if (!(await authed())) return json({ error: 'unauthorized' }, 401);
  await clearEvents();
  return json({ ok: true });
}

export async function GET(req: Request) {
  if (!(await authed())) return json({ error: 'unauthorized' }, 401);

  const asked = new URL(req.url).searchParams.get('range') || '7d';
  const range = RANGES[asked] !== undefined ? asked : '7d';
  const days = RANGES[range];
  const since = days ? Date.now() - days * 86_400_000 : 0;

  let events: TrackEvent[] = [];
  let storeError: string | null = null;
  try {
    events = await readEvents();
  } catch {
    storeError = 'read_failed';
  }
  if (since) events = events.filter((e) => Date.parse(e.ts) >= since);

  const pageViews = new Map<string, number>();
  const ctas = new Map<string, number>();
  const packs = new Map<string, number>();
  const referrers = new Map<string, number>();
  const byDay = new Map<string, number>();
  const visitors = new Set<string>();
  const sessions = new Set<string>();
  const scrollByPage = new Map<string, { sum: number; n: number }>();
  const timeByPage = new Map<string, { sum: number; n: number }>();
  let mobile = 0;
  let desktop = 0;

  const counts: Record<string, number> = {
    page_view: 0, scroll_depth: 0, cta_click: 0, pack_click: 0,
    card_start: 0, buy_submit: 0, error_view: 0, waitlist_submit: 0, exit: 0, lead: 0,
  };

  // captured e-mail addresses, newest first, deduplicated
  const leads: { email: string; source: string; ts: string }[] = [];
  const seenLeads = new Set<string>();

  for (const e of events) {
    if (e.event === 'lead') {
      counts.lead += 1;
      if (e.visitor && !seenLeads.has(e.visitor)) {
        seenLeads.add(e.visitor);
        leads.push({ email: e.visitor, source: e.label, ts: e.ts });
      }
      continue;
    }
    if (counts[e.event] === undefined) continue;
    counts[e.event] += 1;
    if (e.visitor) visitors.add(e.visitor);
    if (e.session) sessions.add(e.session);

    if (e.event === 'page_view') {
      bump(pageViews, e.page);
      bump(byDay, (e.ts || '').slice(0, 10));
      if (e.ref) {
        try {
          bump(referrers, new URL(e.ref).hostname);
        } catch {
          bump(referrers, 'bilinmiyor');
        }
      } else bump(referrers, 'doğrudan');
      if (typeof e.vw === 'number') e.vw < 760 ? (mobile += 1) : (desktop += 1);
    }

    if (e.event === 'cta_click') bump(ctas, e.label || '(isimsiz)');
    if (e.event === 'pack_click') bump(packs, e.label || '(bilinmiyor)');

    if (e.event === 'scroll_depth' && typeof e.value === 'number') {
      const rec = scrollByPage.get(e.page) || { sum: 0, n: 0 };
      rec.sum += e.value; rec.n += 1;
      scrollByPage.set(e.page, rec);
    }
    if (e.event === 'exit' && typeof e.value === 'number') {
      const rec = timeByPage.get(e.page) || { sum: 0, n: 0 };
      rec.sum += e.value; rec.n += 1;
      timeByPage.set(e.page, rec);
    }
  }

  // funnel: unique sessions that reached each step
  const stepSessions = new Map<string, Set<string>>();
  for (const e of events) {
    if (e.event !== 'page_view' || !e.session) continue;
    if (!stepSessions.has(e.page)) stepSessions.set(e.page, new Set());
    stepSessions.get(e.page)!.add(e.session);
  }
  const first = stepSessions.get('index')?.size ?? 0;
  const funnel = FUNNEL.map((step) => {
    const n = stepSessions.get(step.key)?.size ?? 0;
    return {
      key: step.key,
      label: step.label,
      sessions: n,
      share: first ? Math.round((n / first) * 1000) / 10 : 0,
    };
  });

  const avg = (map: Map<string, { sum: number; n: number }>) =>
    Array.from(map, ([name, r]) => ({ name, value: Math.round(r.sum / r.n) })).sort(
      (a, b) => b.value - a.value,
    );

  return json({
    range,
    storage: hasKV() ? 'kv' : 'memory',
    storeError,
    totals: { events: events.length, visitors: visitors.size, sessions: sessions.size, ...counts },
    pageViews: toSorted(pageViews),
    funnel,
    ctas: toSorted(ctas, 15),
    packs: toSorted(packs),
    referrers: toSorted(referrers, 10),
    byDay: Array.from(byDay, ([name, count]) => ({ name, count })).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    devices: { mobile, desktop },
    avgScroll: avg(scrollByPage),
    avgSeconds: avg(timeByPage),
    leads: leads.slice(0, 200),
    recent: events.slice(0, 40).map((e) => ({
      ts: e.ts, event: e.event, page: e.page, label: e.label, value: e.value,
    })),
  });
}
