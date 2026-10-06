import { and, count, countDistinct, eq, gte, inArray, isNotNull, lt, sql, sum } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { jobs, pages, payments, users } from '@/db/schema';

const DAY = 86_400_000;
// a sent job that has not moved for this long is listed as stuck
export const STUCK_HOURS = 2;
export const OPEN_STATUSES = ['queued', 'processing', 'rubric', 'review', 'delivering'] as const;

export type Overview = Awaited<ReturnType<typeof overview>>;

// Raw-SQL cutoffs go in as ISO text and are cast: the postgres driver
// refuses a Date there (PGlite in tests does not).
// Days are Turkish calendar days (UTC+3 all year, no daylight saving).
const TZ = 'Europe/Istanbul';
export const trDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
const startOfTrDay = (d: Date) => new Date(`${trDay(d)}T00:00:00+03:00`);

export async function overview(db: Db, now = new Date()) {
  const startOfDay = startOfTrDay(now);
  const d7 = new Date(now.getTime() - 7 * DAY);
  const d30 = new Date(now.getTime() - 30 * DAY);

  const revenue = async (from: Date) => {
    const [r] = await db.select({ kurus: sum(payments.amountKurus), n: count() }).from(payments)
      .where(and(eq(payments.status, 'paid'), gte(payments.paidAt, from)));
    return { kurus: Number(r.kurus ?? 0), payments: Number(r.n) };
  };
  const signups = async (from: Date) => {
    const [r] = await db.select({ n: count() }).from(users).where(gte(users.createdAt, from));
    return Number(r.n);
  };

  const [[userTotals], [paying], [pageTotals], statusRows, [stuck], [failed30]] = await Promise.all([
    db.select({
      total: count(),
      verified: sql<number>`count(*) filter (where ${users.emailVerifiedAt} is not null)::int`,
      suspended: sql<number>`count(*) filter (where ${users.suspendedAt} is not null)::int`,
      balance: sql<number>`coalesce(sum(${users.pageBalance}), 0)::int`,
    }).from(users),
    db.select({ n: countDistinct(payments.userId) }).from(payments).where(eq(payments.status, 'paid')),
    db.select({
      read: sql<number>`count(*) filter (where ${pages.status} = 'read')::int`,
      failed: sql<number>`count(*) filter (where ${pages.status} = 'failed')::int`,
      inputTokens: sql<number>`coalesce(sum(${pages.inputTokens}), 0)::bigint`,
      outputTokens: sql<number>`coalesce(sum(${pages.outputTokens}), 0)::bigint`,
    }).from(pages).where(and(eq(pages.kind, 'student'), gte(pages.createdAt, d30))),
    db.select({ status: jobs.status, n: count() }).from(jobs).groupBy(jobs.status),
    db.select({ n: count() }).from(jobs).where(and(
      inArray(jobs.status, ['queued', 'processing', 'delivering']),
      lt(jobs.submittedAt, new Date(now.getTime() - STUCK_HOURS * 3_600_000)),
    )),
    db.select({ n: count() }).from(jobs).where(and(eq(jobs.status, 'failed'), isNotNull(jobs.finishedAt), gte(jobs.finishedAt, d30))),
  ]);

  const byStatus = Object.fromEntries(statusRows.map((r) => [r.status, Number(r.n)])) as Record<string, number>;
  const open = OPEN_STATUSES.reduce((n, s) => n + (byStatus[s] ?? 0), 0);

  return {
    revenue: { today: await revenue(startOfDay), d7: await revenue(d7), d30: await revenue(d30) },
    signups: { today: await signups(startOfDay), d7: await signups(d7), d30: await signups(d30) },
    users: {
      total: Number(userTotals.total), verified: Number(userTotals.verified),
      suspended: Number(userTotals.suspended), paying: Number(paying.n), outstandingPages: Number(userTotals.balance),
    },
    pages30: {
      read: Number(pageTotals.read), failed: Number(pageTotals.failed),
      inputTokens: Number(pageTotals.inputTokens), outputTokens: Number(pageTotals.outputTokens),
    },
    jobs: { byStatus, open, stuck: Number(stuck.n), failed30: Number(failed30.n) },
    series: await daily(db, now, 30),
  };
}

export type DayPoint = { day: string; revenueKurus: number; signups: number; jobs: number };

// One row per day for the last `days` days, today included, gaps filled.
async function daily(db: Db, now: Date, days: number): Promise<DayPoint[]> {
  const from = sql`${startOfTrDay(new Date(now.getTime() - (days - 1) * DAY)).toISOString()}::timestamptz`;
  const day = (col: unknown) => sql<string>`to_char(${col} at time zone ${TZ}, 'YYYY-MM-DD')`;
  const [rev, sign, sent] = await Promise.all([
    db.select({ d: day(payments.paidAt), v: sql<number>`sum(${payments.amountKurus})::int` }).from(payments)
      .where(and(eq(payments.status, 'paid'), sql`${payments.paidAt} >= ${from}`)).groupBy(sql`1`),
    db.select({ d: day(users.createdAt), v: sql<number>`count(*)::int` }).from(users)
      .where(sql`${users.createdAt} >= ${from}`).groupBy(sql`1`),
    db.select({ d: day(jobs.submittedAt), v: sql<number>`count(*)::int` }).from(jobs)
      .where(sql`${jobs.submittedAt} >= ${from}`).groupBy(sql`1`),
  ]);
  const map = (rows: { d: string; v: number }[]) => new Map(rows.map((r) => [r.d, Number(r.v)]));
  const [r, s, j] = [map(rev), map(sign), map(sent)];
  const out: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = trDay(new Date(now.getTime() - i * DAY));
    out.push({ day: d, revenueKurus: r.get(d) ?? 0, signups: s.get(d) ?? 0, jobs: j.get(d) ?? 0 });
  }
  return out;
}
