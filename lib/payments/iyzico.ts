import Iyzipay from 'iyzipay';
import { and, eq } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { payments } from '@/db/schema';
import { PACKS, type PackName } from '@/lib/packs';
import { grantPages } from '@/lib/credits';

export type IyzicoApi = { initialize(req: object): Promise<any>; retrieve(req: object): Promise<any> };

let cached: IyzicoApi | null = null;
export function getIyzico(): IyzicoApi {
  if (cached) return cached;
  const client = new Iyzipay({
    apiKey: process.env.IYZICO_API_KEY,
    secretKey: process.env.IYZICO_SECRET_KEY,
    uri: process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com',
  });
  const call = (fn: any) => (req: object) =>
    new Promise((resolve, reject) => fn(req, (err: unknown, res: unknown) => (err ? reject(err) : resolve(res))));
  cached = {
    initialize: call(client.checkoutFormInitialize.create.bind(client.checkoutFormInitialize)),
    retrieve: call(client.checkoutForm.retrieve.bind(client.checkoutForm)),
  };
  return cached;
}

const tl = (kurus: number) => (kurus / 100).toFixed(2);

export async function startCheckout(
  db: Db, api: IyzicoApi,
  input: { userId: string; email: string; pack: PackName; ip: string; appUrl: string },
) {
  const pack = PACKS[input.pack];
  const amountKurus = pack.price * 100;
  const [payment] = await db.insert(payments).values({
    userId: input.userId, pack: pack.name, pages: pack.pages, amountKurus,
  }).returning({ id: payments.id });

  const price = tl(amountKurus);
  const res = await api.initialize({
    locale: 'tr',
    conversationId: payment.id,
    price, paidPrice: price, currency: 'TRY',
    basketId: payment.id,
    paymentGroup: 'PRODUCT',
    callbackUrl: `${input.appUrl}/api/pay/callback`,
    enabledInstallments: [1],
    buyer: {
      id: input.userId,
      name: 'SınavOku', surname: 'Kullanıcısı',
      email: input.email,
      identityNumber: process.env.IYZICO_DEFAULT_TCKN || '11111111111',
      registrationAddress: 'Türkiye', city: 'Istanbul', country: 'Turkey', ip: input.ip,
    },
    billingAddress: { contactName: input.email, city: 'Istanbul', country: 'Turkey', address: 'Türkiye' },
    basketItems: [{ id: pack.name, name: `${pack.short} (${pack.pages} sayfa)`, category1: 'Dijital hizmet', itemType: 'VIRTUAL', price }],
  });
  if (res?.status !== 'success' || !res.token) {
    await db.update(payments).set({ status: 'failed' }).where(eq(payments.id, payment.id));
    throw new Error(`iyzico_init_failed:${res?.errorCode ?? 'unknown'}`);
  }
  await db.update(payments).set({ providerToken: res.token }).where(eq(payments.id, payment.id));
  return { paymentPageUrl: res.paymentPageUrl as string };
}

export async function finishCheckout(db: Db, api: IyzicoApi, token: string): Promise<'paid' | 'failed' | 'unknown'> {
  const [payment] = await db.select().from(payments).where(eq(payments.providerToken, token));
  if (!payment) return 'unknown';
  if (payment.status === 'paid') return 'paid';

  const res = await api.retrieve({ locale: 'tr', conversationId: payment.id, token });
  const ok = res?.status === 'success'
    && res.paymentStatus === 'SUCCESS'
    && res.basketId === payment.id
    && Math.round(Number(res.paidPrice) * 100) >= payment.amountKurus;

  if (!ok) {
    await db.update(payments).set({ status: 'failed' })
      .where(and(eq(payments.id, payment.id), eq(payments.status, 'pending')));
    return 'failed';
  }
  const flipped = await db.update(payments).set({ status: 'paid', paidAt: new Date() })
    .where(and(eq(payments.id, payment.id), eq(payments.status, 'pending')))
    .returning({ id: payments.id });
  if (flipped.length && payment.userId) await grantPages(db, payment.userId, payment.pages, 'purchase', payment.id);
  return 'paid';
}
