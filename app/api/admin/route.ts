// Panel login / logout / session check.
//
// The password never reaches the client: the browser posts an attempt, this
// route compares it in constant time against ADMIN_PASSWORD and, on success,
// sets a signed HttpOnly cookie. Failures are throttled per IP and the
// response never distinguishes a wrong password from an unconfigured panel.

import { cookies } from 'next/headers';
import {
  COOKIE,
  clientIp,
  hasKV,
  issueToken,
  noteAttempt,
  passwordMatches,
  sessionCookie,
  tooManyAttempts,
  verifyToken,
} from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(req: Request) {
  const action = new URL(req.url).searchParams.get('action');
  if (action !== 'session') return json({ error: 'not_found' }, 404);

  const jar = await cookies();
  return json({ authed: verifyToken(jar.get(COOKIE)?.value), kv: hasKV() });
}

export async function POST(req: Request) {
  const action = new URL(req.url).searchParams.get('action');
  const jar = await cookies();

  if (action === 'logout') {
    jar.delete(COOKIE);
    return json({ ok: true });
  }

  const ip = clientIp(req);
  if (tooManyAttempts(ip)) return json({ error: 'too_many_attempts' }, 429);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const attempt = typeof body.password === 'string' ? body.password.slice(0, 200) : '';

  const ok = attempt.length > 0 && passwordMatches(attempt);
  noteAttempt(ip, ok);

  if (!ok) {
    // fixed delay so a wrong password is not measurably faster
    await new Promise((r) => setTimeout(r, 400));
    return json({ error: 'invalid_credentials' }, 401);
  }

  const token = issueToken();
  if (!token) {
    // ADMIN_SECRET missing or too short — refuse rather than issue a
    // signature anyone could forge
    return json({ error: 'server_not_configured' }, 500);
  }

  jar.set(sessionCookie(token));
  return json({ ok: true, kv: hasKV() });
}
