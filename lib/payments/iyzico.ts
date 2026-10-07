import Iyzipay from 'iyzipay';
import { and, eq, gt, isNotNull, lt, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { payments } from '@/db/schema';
import { DEFAULT_PLAN, PACKS, type PackName } from '@/lib/packs';
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

// The Başlangıç pack is the intro offer ("İlk siparişe özel": ₺50 instead of
// ₺500). Without this check it could be bought again and again, and no one
// would ever pay the regular price.
export class IntroPackUsed extends Error {}
// Two payment pages for the intro offer open at once (two tabs, a double
// click) could both be paid; while one is open, a second is not started.
export class IntroPackPending extends Error {}
const OPEN_CHECKOUT_MS = 30 * 60 * 1000;
export const INTRO_PACK: PackName = DEFAULT_PLAN;

export async function startCheckout(
  db: Db, api: IyzicoApi,
  input: { userId: string; email: string; pack: PackName; ip: string; appUrl: string },
) {
  const pack = PACKS[input.pack];
  const amountKurus = pack.price * 100;
  // The checks and the new row share one transaction under a per-teacher
  // lock: two clicks at the same moment would otherwise both pass the checks
  // and open two intro payment pages.
  const payment = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'checkout:' + input.userId}))`);
    if (pack.name === INTRO_PACK) {
      const [earlier] = await tx.select({ id: payments.id }).from(payments)
        .where(and(eq(payments.userId, input.userId), eq(payments.status, 'paid'))).limit(1);
      if (earlier) throw new IntroPackUsed('intro_pack_used');
      // a page still being opened (no token yet) counts as open too
      const [open] = await tx.select({ id: payments.id }).from(payments).where(and(
        eq(payments.userId, input.userId), eq(payments.pack, INTRO_PACK), eq(payments.status, 'pending'),
        gt(payments.createdAt, new Date(Date.now() - OPEN_CHECKOUT_MS)),
      )).limit(1);
      if (open) throw new IntroPackPending('intro_pack_pending');
    }
    const [row] = await tx.insert(payments).values({
      userId: input.userId, pack: pack.name, pages: pack.pages, amountKurus,
    }).returning({ id: payments.id });
    return row;
  });

  const price = tl(amountKurus);
  const fail = () => db.update(payments).set({ status: 'failed' }).where(eq(payments.id, payment.id));
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
  }).catch(async (e: unknown) => {
    await fail();
    throw e;
  });
  if (res?.status !== 'success' || !res.token) {
    await fail();
    throw new Error(`iyzico_init_failed:${res?.errorCode ?? 'unknown'}`);
  }
  await db.update(payments).set({ providerToken: res.token }).where(eq(payments.id, payment.id));
  return { paymentPageUrl: res.paymentPageUrl as string };
}

// 'pending': iyzico could not be asked or gave no answer (a timeout, its own
// error). The payment stays open and the worker's sweep asks again; marking
// it failed here would lose the pages of a payer who did pay.
export type CheckoutResult = 'paid' | 'failed' | 'pending' | 'unknown';

export async function finishCheckout(db: Db, api: IyzicoApi, token: string): Promise<CheckoutResult> {
  const [payment] = await db.select().from(payments).where(eq(payments.providerToken, token));
  if (!payment) return 'unknown';
  if (payment.status === 'paid') return 'paid';

  const res = await api.retrieve({ locale: 'tr', conversationId: payment.id, token });
  if (res?.status !== 'success') {
    console.error('[pay] retrieve gave no answer', payment.id, res?.errorCode ?? '', res?.errorMessage ?? '');
    return payment.status === 'failed' ? 'failed' : 'pending';
  }
  const ok = res.paymentStatus === 'SUCCESS'
    && res.basketId === payment.id
    && Math.round(Number(res.paidPrice) * 100) >= payment.amountKurus;

  if (!ok) {
    await db.update(payments).set({ status: 'failed' })
      .where(and(eq(payments.id, payment.id), eq(payments.status, 'pending')));
    return 'failed';
  }
  // one transaction: a payment is never left 'paid' without its pages, which
  // a replayed callback could not fix because it stops at status 'paid'
  await db.transaction(async (tx) => {
    const flipped = await tx.update(payments).set({ status: 'paid', paidAt: new Date() })
      .where(and(eq(payments.id, payment.id), eq(payments.status, 'pending')))
      .returning({ id: payments.id });
    if (flipped.length && payment.userId) await grantPages(tx, payment.userId, payment.pages, 'purchase', payment.id);
  });
  return 'paid';
}

// A payer who closes the tab after paying never brings the callback back; the
// worker asks iyzico about open payments, so paid pages are never lost.
export async function reconcilePayments(db: Db, api: IyzicoApi, now = new Date()): Promise<number> {
  const open = await db.select({ token: payments.providerToken }).from(payments).where(and(
    eq(payments.status, 'pending'), isNotNull(payments.providerToken),
    lt(payments.createdAt, new Date(now.getTime() - 10 * 60 * 1000)),
    gt(payments.createdAt, new Date(now.getTime() - 48 * 3_600_000)),
  )).limit(20);
  let settled = 0;
  for (const { token } of open) {
    try {
      const r = await finishCheckout(db, api, token!);
      if (r === 'paid' || r === 'failed') settled++;
    } catch (e) {
      console.error('[pay] reconcile failed', e instanceof Error ? e.message : e);
    }
  }
  return settled;
}
