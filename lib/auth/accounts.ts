import crypto from 'node:crypto';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { authTokens, users, type UserRole } from '@/db/schema';
import type { Mailer } from '@/lib/mail';
import { hashPassword, passwordProblem, verifyPassword } from './password';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TTL_MS = { verify: 48 * 3_600_000, reset: 30 * 60_000 } as const;
type Purpose = keyof typeof TTL_MS;

const hash = (t: string) => crypto.createHash('sha256').update(t).digest('hex');
export const normalizeEmail = (raw: unknown) => (typeof raw === 'string' ? raw.trim().toLowerCase().slice(0, 254) : '');
export const validEmail = (email: string) => EMAIL_RE.test(email);

// Addresses in ADMIN_EMAILS (comma separated) become admins when they sign
// up or in: the first admin needs no database access to appear.
function bootstrapRole(email: string): UserRole | null {
  const list = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.includes(email) ? 'admin' : null;
}

export type AuthUser = { id: string; email: string; sessionVersion: number; role: UserRole };

async function issueToken(db: Db, userId: string, purpose: Purpose): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  await db.insert(authTokens).values({
    tokenHash: hash(token), userId, purpose, expiresAt: new Date(Date.now() + TTL_MS[purpose]),
  });
  return token;
}

// Spends a one-time token; the user it belongs to, or null.
async function spendToken(db: Db, token: string, purpose: Purpose): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const [row] = await db.update(authTokens).set({ usedAt: new Date() })
    .where(and(
      eq(authTokens.tokenHash, hash(token)), eq(authTokens.purpose, purpose),
      isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date()),
    ))
    .returning({ userId: authTokens.userId });
  return row?.userId ?? null;
}

export type RegisterInput = { name: unknown; email: unknown; password: unknown };
export type RegisterResult =
  | { ok: true; user: AuthUser }
  | { ok: false; field: 'name' | 'email' | 'password'; message: string; taken?: true };

export async function register(db: Db, mailer: Mailer, input: RegisterInput, appUrl: string): Promise<RegisterResult> {
  const name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/g, ' ').slice(0, 80) : '';
  const email = normalizeEmail(input.email);
  if (name.length < 2) return { ok: false, field: 'name', message: 'Adınızı ve soyadınızı yazın.' };
  if (!validEmail(email)) return { ok: false, field: 'email', message: 'Geçerli bir e-posta adresi yazın.' };
  const weak = passwordProblem(input.password);
  if (weak) return { ok: false, field: 'password', message: weak };

  const passwordHash = await hashPassword(input.password as string);
  const [user] = await db.insert(users)
    .values({ email, name, passwordHash, role: bootstrapRole(email) ?? 'teacher', lastLoginAt: new Date() })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id, email: users.email, sessionVersion: users.sessionVersion, role: users.role });
  if (!user) {
    return { ok: false, field: 'email', taken: true, message: 'Bu e-posta ile bir hesap var. Giriş yapın ya da şifrenizi sıfırlayın.' };
  }
  await sendVerification(db, mailer, user.id, appUrl);
  return { ok: true, user };
}

export async function sendVerification(db: Db, mailer: Mailer, userId: string, appUrl: string) {
  const [u] = await db.select({ email: users.email, name: users.name, verified: users.emailVerifiedAt })
    .from(users).where(eq(users.id, userId));
  if (!u || u.verified) return false;
  const token = await issueToken(db, userId, 'verify');
  await mailer.send({
    to: u.email,
    subject: 'SınavOku e-posta adresinizi doğrulayın',
    text: `Merhaba ${u.name || ''},\n\nSınavOku hesabınızı etkinleştirmek için e-posta adresinizi doğrulayın (48 saat geçerli):\n${appUrl}/dogrula?token=${token}\n\nBu hesabı siz açmadıysanız e-postayı yok sayabilirsiniz.`,
  });
  return true;
}

export async function verifyEmail(db: Db, token: string): Promise<string | null> {
  const userId = await spendToken(db, token, 'verify');
  if (!userId) return null;
  await db.update(users).set({ emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())` }).where(eq(users.id, userId));
  return userId;
}

export type LoginResult = { ok: true; user: AuthUser } | { ok: false; reason: 'invalid' | 'suspended' };

export async function authenticate(db: Db, rawEmail: unknown, password: unknown): Promise<LoginResult> {
  const email = normalizeEmail(rawEmail);
  const pw = typeof password === 'string' ? password.slice(0, 200) : '';
  const [u] = validEmail(email) ? await db.select().from(users).where(eq(users.email, email)) : [];
  // always runs a full scrypt, account or not
  const match = await verifyPassword(pw, u?.passwordHash);
  if (!u || !match) return { ok: false, reason: 'invalid' };
  if (u.suspendedAt) return { ok: false, reason: 'suspended' };
  const role = bootstrapRole(email) ?? u.role;
  await db.update(users).set({ lastLoginAt: new Date(), role }).where(eq(users.id, u.id));
  return { ok: true, user: { id: u.id, email: u.email, sessionVersion: u.sessionVersion, role } };
}

// Same answer for an unknown address: nobody learns who has an account.
export async function requestPasswordReset(db: Db, mailer: Mailer, rawEmail: unknown, appUrl: string) {
  const email = normalizeEmail(rawEmail);
  if (!validEmail(email)) return false;
  const [u] = await db.select({ id: users.id, suspended: users.suspendedAt }).from(users).where(eq(users.email, email));
  if (!u || u.suspended) return true;
  const token = await issueToken(db, u.id, 'reset');
  await mailer.send({
    to: email,
    subject: 'SınavOku şifre sıfırlama',
    text: `SınavOku şifrenizi yenilemek için bağlantıyı açın (30 dakika geçerli):\n${appUrl}/sifre-yenile?token=${token}\n\nBu isteği siz yapmadıysanız e-postayı yok sayın; şifreniz değişmez.`,
  });
  return true;
}

export type ResetResult = { ok: true; user: AuthUser } | { ok: false; message: string };

export async function resetPassword(db: Db, token: unknown, password: unknown): Promise<ResetResult> {
  const weak = passwordProblem(password);
  if (weak) return { ok: false, message: weak };
  const userId = await spendToken(db, typeof token === 'string' ? token : '', 'reset');
  if (!userId) return { ok: false, message: 'Bağlantı geçersiz ya da süresi dolmuş. Yeni bir sıfırlama bağlantısı isteyin.' };
  const passwordHash = await hashPassword(password as string);
  // the link came through the mailbox, so the address is proven too
  const [user] = await db.update(users).set({
    passwordHash,
    sessionVersion: sql`${users.sessionVersion} + 1`,
    emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())`,
    lastLoginAt: new Date(),
  }).where(and(eq(users.id, userId), isNull(users.suspendedAt)))
    .returning({ id: users.id, email: users.email, sessionVersion: users.sessionVersion, role: users.role });
  if (!user) return { ok: false, message: 'Bu hesap askıya alınmış.' };
  // any other reset link still in the mailbox stops working
  await db.update(authTokens).set({ usedAt: new Date() })
    .where(and(eq(authTokens.userId, userId), eq(authTokens.purpose, 'reset'), isNull(authTokens.usedAt)));
  return { ok: true, user };
}

export type ChangeResult = { ok: true; sessionVersion: number } | { ok: false; field: 'current' | 'next'; message: string };

export async function changePassword(db: Db, userId: string, current: unknown, next: unknown): Promise<ChangeResult> {
  const [u] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, userId));
  if (!u || !(await verifyPassword(typeof current === 'string' ? current : '', u.hash))) {
    return { ok: false, field: 'current', message: 'Mevcut şifreniz hatalı.' };
  }
  const weak = passwordProblem(next);
  if (weak) return { ok: false, field: 'next', message: weak };
  const [row] = await db.update(users)
    .set({ passwordHash: await hashPassword(next as string), sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, userId)).returning({ sessionVersion: users.sessionVersion });
  return { ok: true, sessionVersion: row.sessionVersion };
}
