import { fromOwnOrigin } from './origin';
import { sessionConfigured } from './session';

const fail = (error: string, status: number) =>
  Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

// Every sign-in style POST (register, login, reset): from our own pages
// only, so a form on another site cannot sign a teacher in to an attacker's
// account (login CSRF), and never on a server that cannot sign the cookie
// it would hand out.
export function authPostRefusal(req: Request): Response | null {
  if (!fromOwnOrigin(req, process.env.APP_URL!)) return fail('İstek reddedildi.', 403);
  if (!sessionConfigured()) {
    console.error('[auth] SESSION_SECRET is missing or shorter than 32 characters');
    return fail('Sunucu yapılandırması eksik. Biraz sonra tekrar deneyin.', 503);
  }
  return null;
}
