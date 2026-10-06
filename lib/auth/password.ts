import crypto from 'node:crypto';

// scrypt with Node's defaults (N=16384, r=8, p=1): ~16 MB and a few tens of
// milliseconds per check. Stored as scrypt$N$r$p$salt$hash so the cost can
// be raised later without breaking old hashes.
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 32;

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;

const derive = (password: string, salt: Buffer, n: number, r: number, p: number) =>
  new Promise<Buffer>((resolve, reject) =>
    crypto.scrypt(password.normalize('NFC'), salt, KEYLEN, { N: n, r, p, maxmem: 64 * 1024 * 1024 },
      (err, key) => (err ? reject(err) : resolve(key))));

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

// A made-up hash checked when the account does not exist, so a wrong e-mail
// costs the same time as a wrong password and the answer time gives nothing away.
const DUMMY = `scrypt$${N}$${R}$${P}$${Buffer.alloc(16).toString('base64url')}$${Buffer.alloc(KEYLEN).toString('base64url')}`;

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const parts = (stored || DUMMY).split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, salt, hash] = parts;
  const want = Buffer.from(hash, 'base64url');
  const got = await derive(password, Buffer.from(salt, 'base64url'), Number(n), Number(r), Number(p));
  return got.length === want.length && crypto.timingSafeEqual(got, want) && !!stored;
}

// Turkish message for a password that will not do, or null when it is fine.
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN) return `Şifre en az ${PASSWORD_MIN} karakter olmalı.`;
  if (password.length > PASSWORD_MAX) return 'Şifre çok uzun.';
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) return 'Şifrede en az bir harf ve bir rakam olsun.';
  return null;
}
