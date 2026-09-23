// Event log for the funnel: which pages people land on, how far they scroll,
// which package they click, where they drop out.
//
// PRIVACY: no card details are collected anywhere in this product, and this
// endpoint drops any property that is not on the allow-list below. The
// visitor id is a random value generated in the browser — no cookies, no IP
// storage, no fingerprinting.

import { pushEvents, type TrackEvent } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EVENTS = new Set([
  'page_view',
  'scroll_depth',
  'cta_click',
  'pack_click',
  'card_start', // "started filling the order form"
  'buy_submit',
  'error_view',
  'waitlist_submit',
  'exit',
]);

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const batch: unknown[] = Array.isArray(body.events) ? body.events.slice(0, 50) : [body];
  const ua = str(req.headers.get('user-agent'), 200);
  const ts = new Date().toISOString();

  const clean: TrackEvent[] = [];
  for (const raw of batch) {
    const e = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    if (!EVENTS.has(String(e.event))) continue;
    clean.push({
      ts,
      event: String(e.event),
      page: str(e.page, 64),
      label: str(e.label, 64),
      value: num(e.value),
      visitor: str(e.visitor, 40),
      session: str(e.session, 40),
      ref: str(e.ref, 200),
      utm: str(e.utm, 200),
      vw: num(e.vw),
      ua,
    });
  }

  // never let a storage hiccup surface as an error on the site
  try {
    await pushEvents(clean);
  } catch (err) {
    console.error('[sinavoku-track] store_failed', err instanceof Error ? err.message : err);
  }

  return new Response(null, { status: 204 });
}
