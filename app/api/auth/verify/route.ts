import { getDb } from '@/db/client';
import { verifyEmail } from '@/lib/auth/accounts';
import { fromOwnOrigin } from '@/lib/auth/origin';
import { json, readJson } from '@/lib/http';
import { rateLimited } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A POST from /dogrula, not a GET on the mailed link: mail scanners that
// open links must not be the ones to spend the token.
export async function POST(req: Request) {
  if (!fromOwnOrigin(req, process.env.APP_URL!)) return json({ error: 'İstek reddedildi.' }, 403);
  if (await rateLimited('verify', req, 20, 900)) return json({ error: 'Çok fazla deneme. Biraz sonra tekrar deneyin.' }, 429);
  const body = await readJson(req);
  const userId = await verifyEmail(getDb(), typeof body.token === 'string' ? body.token : '');
  if (!userId) return json({ error: 'Doğrulama bağlantısı geçersiz ya da süresi dolmuş. Hesabınızdan yeni bağlantı isteyin.' }, 400);
  return json({ ok: true });
}
