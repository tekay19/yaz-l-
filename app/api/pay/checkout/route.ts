import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { users } from '@/db/schema';
import { currentUserId, unauthorized } from '@/lib/auth/current';
import { isPackName } from '@/lib/packs';
import { IntroPackUsed, getIyzico, startCheckout } from '@/lib/payments/iyzico';
import { clientIp } from '@/lib/store';
import { readJson } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const body = await readJson(req);
  if (!isPackName(body.pack)) return Response.json({ error: 'Paket seçin.' }, { status: 400 });
  const db = getDb();
  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
  try {
    const r = await startCheckout(db, getIyzico(), {
      userId, email: u.email, pack: body.pack, ip: clientIp(req), appUrl: process.env.APP_URL!,
    });
    return Response.json(r);
  } catch (e) {
    if (e instanceof IntroPackUsed) {
      return Response.json({ error: 'Başlangıç paketi yalnızca ilk siparişte alınabilir.' }, { status: 400 });
    }
    console.error('[pay] init', e);
    return Response.json({ error: 'Ödeme sayfası açılamadı. Biraz sonra tekrar deneyin.' }, { status: 502 });
  }
}
