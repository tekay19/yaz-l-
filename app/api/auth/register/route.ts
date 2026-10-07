import { getDb } from '@/db/client';
import { register } from '@/lib/auth/accounts';
import { signIn } from '@/lib/auth/current';
import { authPostRefusal } from '@/lib/auth/guard';
import { json, readJson } from '@/lib/http';
import { getMailer } from '@/lib/mail';
import { rateLimited } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const refused = authPostRefusal(req);
  if (refused) return refused;
  if (await rateLimited('register', req, 5, 3600)) {
    return json({ error: 'Çok fazla deneme. Biraz sonra tekrar deneyin.' }, 429);
  }
  const body = await readJson(req);
  const r = await register(getDb(), getMailer(), { name: body.name, email: body.email, password: body.password }, process.env.APP_URL!);
  if (!r.ok) return json({ error: r.message, field: r.field }, r.taken ? 409 : 400);
  await signIn(r.user.id, r.user.sessionVersion, r.user.role);
  return json({ ok: true, role: r.user.role }, 201);
}
