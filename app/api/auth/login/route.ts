import { getDb } from '@/db/client';
import { requestLogin } from '@/lib/auth/login';
import { getMailer } from '@/lib/mail';
import { rateLimited } from '@/lib/store';
import { readJson } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (await rateLimited('login', req, 5, 900)) {
    return Response.json({ error: 'Çok fazla deneme. Biraz sonra tekrar deneyin.' }, { status: 429 });
  }
  const body = await readJson(req);
  const email = typeof body.email === 'string' ? body.email : '';
  const ok = await requestLogin(getDb(), getMailer(), email, process.env.APP_URL!);
  if (!ok) return Response.json({ error: 'Geçerli bir e-posta adresi yazın.' }, { status: 400 });
  // same answer whether or not the address already has an account
  return Response.json({ ok: true });
}
