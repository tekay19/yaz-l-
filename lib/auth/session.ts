import crypto from 'node:crypto';

export const SESSION_COOKIE = 'so_user';
export const SESSION_TTL_DAYS = 30;
// an admin's cookie opens the whole panel: it lasts a working day, not a month
export const ADMIN_SESSION_TTL_HOURS = 12;
export const sessionTtlSeconds = (role: 'teacher' | 'admin') =>
  role === 'admin' ? ADMIN_SESSION_TTL_HOURS * 3600 : SESSION_TTL_DAYS * 86_400;

function secret(): string | null {
  const s = process.env.SESSION_SECRET || '';
  return s.length >= 32 ? s : null;
}
// Without a usable secret no session can be checked, so none is issued: a
// cookie signed with a stand-in key would look like a login that never holds.
export const sessionConfigured = () => secret() !== null;

const sign = (value: string, key: string) =>
  crypto.createHmac('sha256', key).update(value).digest('base64url');

export type SessionClaim = { userId: string; version: number };

// Format: <userId>.<sessionVersion>.<expiryEpochSeconds>.<hmac>. The version
// is checked against the user row on every request, so a password change,
// a reset or a suspension ends every cookie issued before it.
export function issueSession(userId: string, version: number, now = Date.now(), ttlSeconds = SESSION_TTL_DAYS * 86_400): string {
  const key = secret();
  if (!key) throw new Error('SESSION_SECRET is missing or shorter than 32 characters');
  const exp = String(Math.floor(now / 1000) + ttlSeconds);
  const body = `${userId}.${version}.${exp}`;
  return `${body}.${sign(body, key)}`;
}

export function verifySession(token: string | undefined, now = Date.now()): SessionClaim | null {
  const key = secret();
  if (!key || !token) return null;
  const [userId, version, exp, mac, extra] = token.split('.');
  if (!userId || !version || !exp || !mac || extra !== undefined) return null;
  if (!/^\d+$/.test(version) || !/^\d+$/.test(exp)) return null;
  if (Number(exp) * 1000 < now) return null;
  const a = Buffer.from(mac);
  const b = Buffer.from(sign(`${userId}.${version}.${exp}`, key));
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? { userId, version: Number(version) } : null;
}

export const sessionCookieOptions = (maxAge = SESSION_TTL_DAYS * 86_400) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge,
});
