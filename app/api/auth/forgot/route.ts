import { getDb } from '@/db/client';
import { requestPasswordReset } from '@/lib/auth/accounts';
import { json, readJson } from '@/lib/http';
import { getMailer } from '@/lib/mail';
import { rateLimited } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (await rateLimited('forgot', req, 5, 900)) return json({ error: 'Çok fazla deneme. Biraz sonra tekrar deneyin.' }, 429);
  const body = await readJson(req);
  const ok = await requestPasswordReset(getDb(), getMailer(), body.email, process.env.APP_URL!);
  if (!ok) return json({ error: 'Geçerli bir e-posta adresi yazın.' }, 400);
  // same answer whether or not the address has an account
  return json({ ok: true });
}
