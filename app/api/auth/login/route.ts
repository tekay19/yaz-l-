import { getDb } from '@/db/client';
import { authenticate, normalizeEmail } from '@/lib/auth/accounts';
import { signIn } from '@/lib/auth/current';
import { authPostRefusal } from '@/lib/auth/guard';
import { json, readJson } from '@/lib/http';
import { clientIp, noteAttempt, rateLimited, tooManyAttempts } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLOW_DOWN = 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin ya da şifrenizi sıfırlayın.';

export async function POST(req: Request) {
  const refused = authPostRefusal(req);
  if (refused) return refused;
  if (await rateLimited('login', req, 30, 900)) return json({ error: SLOW_DOWN }, 429);
  const body = await readJson(req);
  // guessing is throttled per address as well as per IP: spreading the
  // attempts over many IPs does not help against one account
  const keys = [`ip:${clientIp(req)}`, `email:${normalizeEmail(body.email)}`];
  if (keys.some((k) => tooManyAttempts(k))) return json({ error: SLOW_DOWN }, 429);

  const r = await authenticate(getDb(), body.email, body.password);
  for (const k of keys) noteAttempt(k, r.ok);
  if (!r.ok) {
    return r.reason === 'suspended'
      ? json({ error: 'Hesabınız askıya alınmış. Destek için bize yazın.' }, 403)
      : json({ error: 'E-posta ya da şifre hatalı. Daha önce e-postadaki bağlantıyla giriş yaptıysanız "Şifremi unuttum" ile şifre belirleyin.' }, 401);
  }
  await signIn(r.user.id, r.user.sessionVersion);
  return json({ ok: true, role: r.user.role });
}
