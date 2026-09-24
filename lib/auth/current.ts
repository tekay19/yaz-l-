import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySession } from './session';

export async function currentUserId(): Promise<string | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

export const unauthorized = () =>
  Response.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
