import { getDb } from '@/db/client';
import { resetPassword } from '@/lib/auth/accounts';
import { signIn } from '@/lib/auth/current';
import { authPostRefusal } from '@/lib/auth/guard';
import { json, readJson } from '@/lib/http';
import { rateLimited } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const refused = authPostRefusal(req);
  if (refused) return refused;
  if (await rateLimited('reset', req, 10, 900)) return json({ error: 'Çok fazla deneme. Biraz sonra tekrar deneyin.' }, 429);
  const body = await readJson(req);
  const r = await resetPassword(getDb(), body.token, body.password);
  if (!r.ok) return json({ error: r.message }, 400);
  await signIn(r.user.id, r.user.sessionVersion);
  return json({ ok: true, role: r.user.role });
}
