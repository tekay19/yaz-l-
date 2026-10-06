import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { getDb } from '@/db/client';
import { users, type UserRole } from '@/db/schema';
import { SESSION_COOKIE, issueSession, sessionCookieOptions, verifySession } from './session';

export type CurrentUser = { id: string; email: string; name: string; role: UserRole; verified: boolean };

// The signed-in user, checked against the database: a cookie from before a
// password change, a reset or a suspension no longer counts.
export async function currentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const claim = verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claim || !/^[0-9a-f-]{36}$/i.test(claim.userId)) return null;
  const [u] = await getDb().select({
    id: users.id, email: users.email, name: users.name, role: users.role,
    version: users.sessionVersion, suspended: users.suspendedAt, verifiedAt: users.emailVerifiedAt,
  }).from(users).where(eq(users.id, claim.userId));
  if (!u || u.suspended || u.version !== claim.version) return null;
  return { id: u.id, email: u.email, name: u.name, role: u.role, verified: !!u.verifiedAt };
}

export async function currentUserId(): Promise<string | null> {
  return (await currentUser())?.id ?? null;
}

export async function signIn(userId: string, sessionVersion: number) {
  (await cookies()).set(SESSION_COOKIE, issueSession(userId, sessionVersion), sessionCookieOptions());
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
}

const noStore = { 'Cache-Control': 'no-store' };

export const unauthorized = () =>
  Response.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401, headers: noStore });

export const unverified = () =>
  Response.json({ error: 'Önce e-posta adresinizi doğrulayın. Doğrulama bağlantısı e-postanıza gönderildi.', code: 'unverified' },
    { status: 403, headers: noStore });

export const forbidden = () => Response.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403, headers: noStore });
