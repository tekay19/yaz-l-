import crypto from 'node:crypto';

export const SESSION_COOKIE = 'so_user';
export const SESSION_TTL_DAYS = 30;

function secret(): string | null {
  const s = process.env.SESSION_SECRET || '';
  return s.length >= 32 ? s : null;
}
const sign = (value: string, key: string) =>
  crypto.createHmac('sha256', key).update(value).digest('base64url');

// Format: <userId>.<expiryEpochSeconds>.<hmac>
export function issueSession(userId: string, now = Date.now()): string {
  const key = secret() ?? 'unset';
  const exp = String(Math.floor(now / 1000) + SESSION_TTL_DAYS * 86_400);
  return `${userId}.${exp}.${sign(`${userId}.${exp}`, key)}`;
}

export function verifySession(token: string | undefined, now = Date.now()): string | null {
  const key = secret();
  if (!key || !token) return null;
  const [userId, exp, mac] = token.split('.');
  if (!userId || !exp || !mac || !/^\d+$/.test(exp)) return null;
  if (Number(exp) * 1000 < now) return null;
  const a = Buffer.from(mac);
  const b = Buffer.from(sign(`${userId}.${exp}`, key));
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? userId : null;
}
