import { getDb } from '@/db/client';
import { changePassword } from '@/lib/auth/accounts';
import { currentUserId, signIn, unauthorized } from '@/lib/auth/current';
import { json, readJson } from '@/lib/http';
import { rateLimited } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Changing the password signs every other device out; this one gets a fresh cookie.
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  if (await rateLimited('password', req, 10, 900)) return json({ error: 'Çok fazla deneme. Biraz sonra tekrar deneyin.' }, 429);
  const body = await readJson(req);
  const r = await changePassword(getDb(), userId, body.current, body.next);
  if (!r.ok) return json({ error: r.message, field: r.field }, 400);
  await signIn(userId, r.sessionVersion);
  return json({ ok: true });
}
