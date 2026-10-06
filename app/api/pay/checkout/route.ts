import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { users } from '@/db/schema';
import { currentUser, unauthorized, unverified } from '@/lib/auth/current';
import { isPackName } from '@/lib/packs';
import { IntroPackPending, IntroPackUsed, getIyzico, startCheckout } from '@/lib/payments/iyzico';
import { clientIp } from '@/lib/store';
import { readJson } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return unauthorized();
  if (!me.verified) return unverified();
  const userId = me.id;
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
    if (e instanceof IntroPackPending) {
      return Response.json({ error: 'Başlangıç paketi için açık bir ödeme sayfanız var. Onu tamamlayın ya da yarım saat sonra yeniden deneyin.' }, { status: 409 });
    }
    if (e instanceof IntroPackUsed) {
      return Response.json({ error: 'Başlangıç paketi yalnızca ilk siparişte alınabilir.' }, { status: 400 });
    }
    console.error('[pay] init', e);
    return Response.json({ error: 'Ödeme sayfası açılamadı. Biraz sonra tekrar deneyin.' }, { status: 502 });
  }
}
