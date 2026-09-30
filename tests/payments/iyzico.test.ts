import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb, makeUser } from '../helpers/db';
import { payments, users } from '@/db/schema';
import { IntroPackUsed, finishCheckout, startCheckout, type IyzicoApi } from '@/lib/payments/iyzico';

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
    // an abandoned attempt does not use the offer up
    await startCheckout(db, api, { userId: u.id, email: u.email, pack: 'Başlangıç', ip: '1.2.3.4', appUrl: 'https://x' });
    expect(await finishCheckout(db, api, 'tok-2')).toBe('paid');
    await expect(startCheckout(db, api, { userId: u.id, email: u.email, pack: 'Başlangıç', ip: '1.2.3.4', appUrl: 'https://x' }))
      .rejects.toBeInstanceOf(IntroPackUsed);
    // the regular packs stay available
    await expect(startCheckout(db, api, { userId: u.id, email: u.email, pack: 'Öğretmen', ip: '1.2.3.4', appUrl: 'https://x' }))
      .resolves.toMatchObject({ paymentPageUrl: 'https://sandbox/pay' });
  });
});
