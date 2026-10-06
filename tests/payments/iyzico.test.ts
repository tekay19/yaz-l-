import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb, makeUser } from '../helpers/db';
import { payments, users } from '@/db/schema';
import { IntroPackPending, IntroPackUsed, finishCheckout, reconcilePayments, startCheckout, type IyzicoApi } from '@/lib/payments/iyzico';

function fakeApi(paid: boolean): IyzicoApi & { basketId?: string } {
  const api: any = {
    initialize: async (req: any) => { api.basketId = req.basketId; return { status: 'success', token: 'tok-1', paymentPageUrl: 'https://sandbox/pay' }; },
    retrieve: async () => ({ status: 'success', paymentStatus: paid ? 'SUCCESS' : 'FAILURE', basketId: api.basketId, paidPrice: '50.00' }),
  };
  return api;
}

describe('iyzico checkout', () => {
  it('credits the pack once, even if the callback repeats', async () => {
    const db = await testDb();
    const u = await makeUser(db);
    const api = fakeApi(true);
    const r = await startCheckout(db, api, { userId: u.id, email: u.email, pack: 'Başlangıç', ip: '1.2.3.4', appUrl: 'https://x' });
    expect(r.paymentPageUrl).toBe('https://sandbox/pay');
    expect(await finishCheckout(db, api, 'tok-1')).toBe('paid');
    expect(await finishCheckout(db, api, 'tok-1')).toBe('paid');
    expect((await db.select().from(users).where(eq(users.id, u.id)))[0].pageBalance).toBe(150);
  });

  it('marks a declined payment failed and grants nothing', async () => {
    const db = await testDb();
    const u = await makeUser(db);
    const api = fakeApi(false);
    await startCheckout(db, api, { userId: u.id, email: u.email, pack: 'Başlangıç', ip: '1.2.3.4', appUrl: 'https://x' });
    expect(await finishCheckout(db, api, 'tok-1')).toBe('failed');
    expect((await db.select().from(payments))[0].status).toBe('failed');
    expect((await db.select().from(users).where(eq(users.id, u.id)))[0].pageBalance).toBe(0);
  });

  it('ignores an unknown token', async () => {
    const db = await testDb();
    expect(await finishCheckout(db, fakeApi(true), 'nope')).toBe('unknown');
  });

  it('sells the intro pack only on the first order', async () => {
    const db = await testDb();
    const u = await makeUser(db);
    let n = 0;
    const api: IyzicoApi = {
      initialize: async () => ({ status: 'success', token: `tok-${++n}`, paymentPageUrl: 'https://sandbox/pay' }),
      retrieve: async (req: any) => ({ status: 'success', paymentStatus: 'SUCCESS', basketId: req.conversationId, paidPrice: '50.00' }),
    };
    await startCheckout(db, api, { userId: u.id, email: u.email, pack: 'Başlangıç', ip: '1.2.3.4', appUrl: 'https://x' });
    // an attempt abandoned for over half an hour does not use the offer up
    await db.update(payments).set({ createdAt: new Date(Date.now() - 31 * 60 * 1000) });
    await startCheckout(db, api, { userId: u.id, email: u.email, pack: 'Başlangıç', ip: '1.2.3.4', appUrl: 'https://x' });
    expect(await finishCheckout(db, api, 'tok-2')).toBe('paid');
    await expect(startCheckout(db, api, { userId: u.id, email: u.email, pack: 'Başlangıç', ip: '1.2.3.4', appUrl: 'https://x' }))
      .rejects.toBeInstanceOf(IntroPackUsed);
    // the regular packs stay available
    await expect(startCheckout(db, api, { userId: u.id, email: u.email, pack: 'Öğretmen', ip: '1.2.3.4', appUrl: 'https://x' }))
      .resolves.toMatchObject({ paymentPageUrl: 'https://sandbox/pay' });
  });

  it('leaves the payment pending when crediting fails, so a replay settles it', async () => {
    const db = await testDb();
    const u = await makeUser(db);
    const api = fakeApi(true);
    await startCheckout(db, api, { userId: u.id, email: u.email, pack: 'Başlangıç', ip: '1.2.3.4', appUrl: 'https://x' });
    // the first transaction fails after its writes, as a dropped connection would
    const real = db.transaction.bind(db);
    let failNext = true;
    (db as any).transaction = (fn: any) => real(async (tx: any) => {
      const out = await fn(tx);
      if (failNext) { failNext = false; throw new Error('connection lost'); }
      return out;
    });
    await expect(finishCheckout(db, api, 'tok-1')).rejects.toThrow('connection lost');
    expect((await db.select().from(payments))[0].status).toBe('pending');
    expect(await finishCheckout(db, api, 'tok-1')).toBe('paid');
    expect((await db.select().from(users).where(eq(users.id, u.id)))[0].pageBalance).toBe(150);
  });

  it('marks the payment failed when the payment page cannot be opened', async () => {
    const db = await testDb();
    const u = await makeUser(db);
    const api: IyzicoApi = {
      initialize: async () => { throw new Error('ECONNRESET'); },
      retrieve: async () => ({}),
    };
    await expect(startCheckout(db, api, { userId: u.id, email: u.email, pack: 'Öğretmen', ip: '1.2.3.4', appUrl: 'https://x' }))
      .rejects.toThrow('ECONNRESET');
    expect((await db.select().from(payments))[0].status).toBe('failed');
  });

  it('does not open a second intro payment page while one is open', async () => {
    const db = await testDb();
    const u = await makeUser(db);
    let n = 0;
    const api: IyzicoApi = {
      initialize: async () => ({ status: 'success', token: `tok-${++n}`, paymentPageUrl: 'https://sandbox/pay' }),
      retrieve: async () => ({}),
    };
    await startCheckout(db, api, { userId: u.id, email: u.email, pack: 'Başlangıç', ip: '1.2.3.4', appUrl: 'https://x' });
    await expect(startCheckout(db, api, { userId: u.id, email: u.email, pack: 'Başlangıç', ip: '1.2.3.4', appUrl: 'https://x' }))
      .rejects.toBeInstanceOf(IntroPackPending);
    // a regular pack is not held back
    await expect(startCheckout(db, api, { userId: u.id, email: u.email, pack: 'Öğretmen', ip: '1.2.3.4', appUrl: 'https://x' }))
      .resolves.toMatchObject({ paymentPageUrl: 'https://sandbox/pay' });
  });

  it('settles a paid order whose callback never came', async () => {
    const db = await testDb();
    const u = await makeUser(db);
    const api = fakeApi(true);
    await startCheckout(db, api, { userId: u.id, email: u.email, pack: 'Başlangıç', ip: '1.2.3.4', appUrl: 'https://x' });
    expect(await reconcilePayments(db, api, new Date())).toBe(0); // too fresh: the payer may still be on the page
    expect(await reconcilePayments(db, api, new Date(Date.now() + 15 * 60 * 1000))).toBe(1);
    expect((await db.select().from(users).where(eq(users.id, u.id)))[0].pageBalance).toBe(150);
  });
});
