import { getDb } from '@/db/client';
import { finishCheckout, getIyzico } from '@/lib/payments/iyzico';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// iyzico posts the form token here after the payment page; the result is
// taken only from our server-side retrieve call, never from this request.
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const token = String(form?.get('token') || '');
  // the payer must land back on the site even if iyzico or the database
  // fails; a replayed callback can still settle the payment later
  const result = token
    ? await finishCheckout(getDb(), getIyzico(), token).catch((e) => {
        console.error('[pay] callback failed', e);
        return 'unknown' as const;
      })
    : 'unknown';
  const q = result === 'paid' ? 'ok' : 'hata';
  return Response.redirect(`${process.env.APP_URL}/hesap?odeme=${q}`, 303);
}
