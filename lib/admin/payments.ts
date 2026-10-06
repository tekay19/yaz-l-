import { and, count, desc, eq, ilike, sql, type SQL } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { payments, users } from '@/db/schema';
import { HttpError } from '@/lib/http';
import { finishCheckout, type IyzicoApi } from '@/lib/payments/iyzico';
import { logAction, type Actor } from './guard';

export const PAYMENT_FILTERS = ['all', 'paid', 'pending', 'failed'] as const;
export type PaymentFilter = (typeof PAYMENT_FILTERS)[number];

export async function listPayments(db: Db, opts: { q?: string; filter?: PaymentFilter; offset: number; size: number }) {
  const where: (SQL | undefined)[] = [];
  const q = (opts.q || '').trim().slice(0, 100);
  if (q) where.push(ilike(users.email, `%${q}%`));
  if (opts.filter === 'paid' || opts.filter === 'pending' || opts.filter === 'failed') where.push(eq(payments.status, opts.filter));
  const cond = and(...where);
  const [rows, [total], [sums]] = await Promise.all([
    db.select({
      id: payments.id, pack: payments.pack, pages: payments.pages, amountKurus: payments.amountKurus,
      status: payments.status, createdAt: payments.createdAt, paidAt: payments.paidAt,
      hasToken: sql<boolean>`${payments.providerToken} is not null`,
      userId: payments.userId, email: users.email,
    }).from(payments).leftJoin(users, eq(users.id, payments.userId)).where(cond)
      .orderBy(desc(payments.createdAt)).limit(opts.size).offset(opts.offset),
    db.select({ n: count() }).from(payments).leftJoin(users, eq(users.id, payments.userId)).where(cond),
    db.select({
      paidKurus: sql<number>`coalesce(sum(${payments.amountKurus}) filter (where ${payments.status} = 'paid'), 0)::int`,
    }).from(payments).leftJoin(users, eq(users.id, payments.userId)).where(cond),
  ]);
  return { rows, total: Number(total.n), paidKurus: Number(sums.paidKurus) };
}

// Asks iyzico about one open payment now instead of waiting for the worker's sweep.
export async function reconcileOne(db: Db, api: IyzicoApi, admin: Actor, paymentId: string) {
  const [p] = await db.select({ status: payments.status, token: payments.providerToken }).from(payments).where(eq(payments.id, paymentId));
  if (!p) throw new HttpError(404, 'Ödeme bulunamadı.');
  if (p.status !== 'pending') throw new HttpError(409, 'Yalnızca bekleyen ödemeler sorgulanabilir.');
  if (!p.token) throw new HttpError(409, 'Bu ödeme iyzico sayfasına hiç ulaşmamış; sorgulanacak bir kayıt yok.');
  const result = await finishCheckout(db, api, p.token);
  await logAction(db, admin, 'payment.reconcile', 'payment', paymentId, { result });
  return result;
}
