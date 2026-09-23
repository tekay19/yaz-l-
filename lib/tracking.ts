'use client';

// Funnel tracking: page views, scroll depth, CTA clicks and time on page go
// to /api/track so the panel can show where people drop out.
//
// What is NEVER sent: any value the visitor types. Only the event name, a
// label chosen in code, and coarse numbers. The visitor id is random and
// stored locally — no cookies, no cross-site identifiers.

const VISITOR_KEY = 'sinavoku_vid';
const SESSION_KEY = 'sinavoku_sid';
const TRACK_URL = '/api/track';
const CONSENT_KEY = 'sinavoku_analytics_consent';
export function analyticsAllowed() {
  try { return typeof window !== 'undefined' && localStorage.getItem(CONSENT_KEY) === 'granted'; }
  catch { return false; }
}
export function setAnalyticsConsent(allowed: boolean) {
  try {
    localStorage.setItem(CONSENT_KEY, allowed ? 'granted' : 'denied');
    if (!allowed) {
      localStorage.removeItem(VISITOR_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    }
  } catch { /* No storage means no analytics. */ }
  if (!allowed) {
    queue = [];
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
  }
}

type Queued = {
  event: string;
  page: string;
  label: string;
  value: number | null;
  visitor: string;
  session: string;
  ref: string;
  utm: string;
  vw: number;
};

const randomId = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function stableId(store: Storage | null, key: string): string {
  try {
    if (!store) return randomId();
    let id = store.getItem(key);
    if (!id) {
      id = randomId();
      store.setItem(key, id);
    }
    return id;
  } catch {
    return randomId();
  }
}

const visitorId = () =>
  stableId(typeof window === 'undefined' ? null : window.localStorage, VISITOR_KEY);
const sessionId = () =>
  stableId(typeof window === 'undefined' ? null : window.sessionStorage, SESSION_KEY);

let queue: Queued[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function post(payload: unknown, beacon: boolean) {
  const body = JSON.stringify(payload);
  if (beacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
    try {
      navigator.sendBeacon(TRACK_URL, new Blob([body], { type: 'application/json' }));
      return;
    } catch {
      /* fall through to fetch */
    }
  }
  fetch(TRACK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
}

export function flush(beacon = false) {
  if (!analyticsAllowed()) { queue = []; return; }
  if (!queue.length) return;
  const events = queue;
  queue = [];
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  post({ events }, beacon);
}

export function track(event: string, page: string, label = '', value: number | null = null) {
  if (typeof window === 'undefined' || !analyticsAllowed()) return;
  queue.push({
    event,
    page,
    label,
    value,
    visitor: visitorId(),
    session: sessionId(),
    ref: '',
    utm: '',
    vw: window.innerWidth,
  });
  // batch rapid events, but never sit on them for long
  if (!flushTimer) flushTimer = setTimeout(() => flush(false), 900);
  if (queue.length >= 10) flush(false);
}
