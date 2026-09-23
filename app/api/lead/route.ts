// Order intent / waitlist capture — the e-mail address is the only personal
// field this product asks for anywhere.
//
// Leads are appended to the same store as the funnel events, so the panel can
// show them, and are echoed to the server log as a fallback.

import { pushEvents, rateLimited } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  // a person joins a waitlist a couple of times at most
  if (await rateLimited('lead', req, 5, 600)) {
    return Response.json({ error: 'too_many_requests' }, { status: 429 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 254) : '';
  const source = typeof body.source === 'string' ? body.source.slice(0, 64) : 'unknown';

  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: 'invalid_email' }, { status: 400 });
  }


  try {
    await pushEvents([
      {
        ts: new Date().toISOString(),
        event: 'lead',
        page: 'lead',
        label: source,
        value: null,
        visitor: email, // the lead list is the point of this record
        session: '',
        ref: '',
        utm: '',
        vw: null,
        ua: '',
      },
    ]);
  } catch (err) {
    console.error('[sinavoku-lead] store_failed', err instanceof Error ? err.message : err);
  }

  return Response.json({ ok: true });
}
