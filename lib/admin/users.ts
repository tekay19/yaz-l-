import { and, count, desc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { classes, jobs, ledger, payments, users, type UserRole } from '@/db/schema';
import { HttpError } from '@/lib/http';
import { logAction, type Actor } from './guard';

export const USER_FILTERS = ['all', 'paying', 'unverified', 'suspended', 'admin'] as const;
export type UserFilter = (typeof USER_FILTERS)[number];

const paidKurus = sql<number>`coalesce((select sum(${payments.amountKurus}) from ${payments} where ${payments.userId} = ${users.id} and ${payments.status} = 'paid'), 0)::int`;
const jobCount = sql<number>`(select count(*) from ${jobs} where ${jobs.userId} = ${users.id} and ${jobs.status} <> 'draft')::int`;

export async function listUsers(db: Db, opts: { q?: string; filter?: UserFilter; offset: number; size: number }) {
  const where: (SQL | undefined)[] = [];
  const q = (opts.q || '').trim().slice(0, 100);
  if (q) where.push(or(ilike(users.email, `%${q}%`), ilike(users.name, `%${q}%`)));
  if (opts.filter === 'paying') where.push(sql`${paidKurus} > 0`);
  if (opts.filter === 'unverified') where.push(isNull(users.emailVerifiedAt));
  if (opts.filter === 'suspended') where.push(isNotNull(users.suspendedAt));
  if (opts.filter === 'admin') where.push(eq(users.role, 'admin'));
  const cond = and(...where);
  const [rows, [total]] = await Promise.all([
    db.select({
      id: users.id, email: users.email, name: users.name, role: users.role,
      verified: sql<boolean>`${users.emailVerifiedAt} is not null`, suspended: sql<boolean>`${users.suspendedAt} is not null`,
      pageBalance: users.pageBalance, createdAt: users.createdAt, lastLoginAt: users.lastLoginAt,
      hasPassword: sql<boolean>`${users.passwordHash} is not null`,
      paidKurus, jobs: jobCount,
    }).from(users).where(cond).orderBy(desc(users.createdAt)).limit(opts.size).offset(opts.offset),
    db.select({ n: count() }).from(users).where(cond),
  ]);
  return { rows, total: Number(total.n) };
}

export async function userDetail(db: Db, id: string) {
  const [u] = await db.select({
    id: users.id, email: users.email, name: users.name, role: users.role,
    emailVerifiedAt: users.emailVerifiedAt, suspendedAt: users.suspendedAt,
    pageBalance: users.pageBalance, createdAt: users.createdAt, lastLoginAt: users.lastLoginAt,
    hasPassword: sql<boolean>`${users.passwordHash} is not null`, paidKurus,
  }).from(users).where(eq(users.id, id));
  if (!u) return null;
  const [jobRows, paymentRows, ledgerRows, [classCount]] = await Promise.all([
    db.select({
      id: jobs.id, title: jobs.title, mode: jobs.mode, status: jobs.status, reservedPages: jobs.reservedPages,
      createdAt: jobs.createdAt, submittedAt: jobs.submittedAt, finishedAt: jobs.finishedAt, failReason: jobs.failReason,
    }).from(jobs).where(eq(jobs.userId, id)).orderBy(desc(jobs.createdAt)).limit(50),
    db.select().from(payments).where(eq(payments.userId, id)).orderBy(desc(payments.createdAt)).limit(50),
    db.select().from(ledger).where(eq(ledger.userId, id)).orderBy(desc(ledger.createdAt)).limit(100),
    db.select({ n: count() }).from(classes).where(eq(classes.userId, id)),
  ]);
  return { user: u, jobs: jobRows, payments: paymentRows, ledger: ledgerRows, classes: Number(classCount.n) };
}

async function target(db: Db, id: string) {
  const [u] = await db.select({ id: users.id, email: users.email, role: users.role, balance: users.pageBalance })
    .from(users).where(eq(users.id, id));
  if (!u) throw new HttpError(404, 'Öğretmen bulunamadı.');
  return u;
}

// Adds (delta > 0) or takes back (delta < 0) page credit, with the reason
// written to the audit log and the ledger row keyed by that log entry.
export async function adjustPages(db: Db, admin: Actor, userId: string, delta: number, note: string) {
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100_000) throw new HttpError(400, 'Geçerli bir sayfa sayısı girin.');
  const reason = note.trim().slice(0, 300);
  if (reason.length < 3) throw new HttpError(400, 'Gerekçe yazın.');
  const u = await target(db, userId);
  return db.transaction(async (tx) => {
    if (delta < 0) {
      // the balance never goes below zero: reserved exams already hold their pages
      const [row] = await tx.select({ balance: users.pageBalance }).from(users).where(eq(users.id, userId)).for('update');
      if (row.balance + delta < 0) throw new HttpError(400, `Bakiye yetersiz: en fazla ${row.balance} sayfa düşülebilir.`);
    }
    const ref = await logAction(tx as unknown as Db, admin, delta > 0 ? 'pages.grant' : 'pages.debit', 'user', userId, { delta, note: reason, email: u.email });
    await tx.insert(ledger).values({ userId, delta, reason: delta > 0 ? 'admin_grant' : 'admin_debit', ref });
    const [after] = await tx.update(users).set({ pageBalance: sql`${users.pageBalance} + ${delta}` })
      .where(eq(users.id, userId)).returning({ balance: users.pageBalance });
    return after.balance;
  });
}

// Suspending signs the teacher out everywhere (the session version moves on).
export async function setSuspended(db: Db, admin: Actor, userId: string, suspend: boolean) {
  const u = await target(db, userId);
  if (u.id === admin.id) throw new HttpError(400, 'Kendi hesabınızı askıya alamazsınız.');
  await db.update(users).set(suspend
    ? { suspendedAt: new Date(), sessionVersion: sql`${users.sessionVersion} + 1` }
    : { suspendedAt: null }).where(eq(users.id, userId));
  await logAction(db, admin, suspend ? 'user.suspend' : 'user.unsuspend', 'user', userId, { email: u.email });
}

export async function setRole(db: Db, admin: Actor, userId: string, role: UserRole) {
  if (role !== 'admin' && role !== 'teacher') throw new HttpError(400, 'Geçersiz rol.');
  const u = await target(db, userId);
  if (u.id === admin.id && role !== 'admin') throw new HttpError(400, 'Kendi yönetici yetkinizi kaldıramazsınız.');
  if (u.role === role) return;
  await db.update(users).set({ role, sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, userId));
  await logAction(db, admin, 'user.role', 'user', userId, { email: u.email, from: u.role, to: role });
}

export async function markVerified(db: Db, admin: Actor, userId: string) {
  const u = await target(db, userId);
  await db.update(users).set({ emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())` }).where(eq(users.id, userId));
  await logAction(db, admin, 'user.verify', 'user', userId, { email: u.email });
}

export async function noteResetSent(db: Db, admin: Actor, userId: string) {
  const u = await target(db, userId);
  await logAction(db, admin, 'user.reset_mail', 'user', userId, { email: u.email });
  return u.email;
}
