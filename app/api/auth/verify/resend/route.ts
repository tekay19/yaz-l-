import { getDb } from '@/db/client';
import { sendVerification } from '@/lib/auth/accounts';
import { currentUser, unauthorized } from '@/lib/auth/current';
import { json } from '@/lib/http';
import { getMailer } from '@/lib/mail';
import { rateLimited } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return unauthorized();
  if (me.verified) return json({ ok: true, already: true });
  if (await rateLimited('resend-verify', req, 3, 900)) return json({ error: 'Çok sık istendi. Birkaç dakika sonra tekrar deneyin.' }, 429);
  await sendVerification(getDb(), getMailer(), me.id, process.env.APP_URL!);
  return json({ ok: true });
}
