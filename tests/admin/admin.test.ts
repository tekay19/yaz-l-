import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb, makeUser } from '../helpers/db';
import { memoryStorage } from '../helpers/storage';
import { fakeMailer } from '../helpers/mail';
import { adminActions, jobs, ledger, pages, payments, users } from '@/db/schema';
import { issueSession } from '@/lib/auth/session';
import { deliverPending } from '@/lib/jobs/deliver';
import { reconcileOne } from '@/lib/admin/payments';
import { overview } from '@/lib/admin/overview';

const APP = 'https://sinavoku.test';
const state = vi.hoisted(() => ({ db: null as any, cookie: undefined as string | undefined }));
vi.mock('@/db/client', () => ({ getDb: () => state.db }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name === 'so_user' && state.cookie ? { value: state.cookie } : undefined),
    set: () => {}, delete: () => {},
  }),
}));

import * as overviewRoute from '@/app/api/admin/overview/route';
import * as usersRoute from '@/app/api/admin/users/route';
import * as userRoute from '@/app/api/admin/users/[id]/route';
import * as jobRoute from '@/app/api/admin/jobs/[id]/route';
import * as jobsRoute from '@/app/api/admin/jobs/route';
import * as auditRoute from '@/app/api/admin/audit/route';
import * as meRoute from '@/app/api/me/route';

process.env.SESSION_SECRET = 's'.repeat(40);
process.env.APP_URL = APP;

const get = (path: string) => new Request(`${APP}${path}`);
const post = (path: string, body: unknown, origin = APP) => new Request(`${APP}${path}`, {
  method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', origin },
});
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function asAdmin() {
  const a = await makeUser(state.db, 'yonetici@sinavoku.com', 0, { role: 'admin', name: 'Yönetici' });
  state.cookie = issueSession(a.id, 0);
  return a;
}

describe('admin API', () => {
  beforeEach(async () => { state.db = await testDb(); state.cookie = undefined; });

  it('is closed to visitors (401) and to teachers (403)', async () => {
    expect((await overviewRoute.GET(get('/api/admin/overview'))).status).toBe(401);
    const t = await makeUser(state.db);
    state.cookie = issueSession(t.id, 0);
    expect((await overviewRoute.GET(get('/api/admin/overview'))).status).toBe(403);
    expect((await usersRoute.GET(get('/api/admin/users'))).status).toBe(403);
    expect((await userRoute.POST(post(`/api/admin/users/${t.id}`, { action: 'pages', delta: 100, note: 'hile' }), ctx(t.id))).status).toBe(403);
    const [u] = await state.db.select().from(users).where(eq(users.id, t.id));
    expect(u.pageBalance).toBe(0);
  });

  it('refuses a change posted from another site even with an admin cookie', async () => {
    await asAdmin();
    const t = await makeUser(state.db);
    const res = await userRoute.POST(post(`/api/admin/users/${t.id}`, { action: 'pages', delta: 5, note: 'deneme' }, 'https://evil.example'), ctx(t.id));
    expect(res.status).toBe(403);
  });

  it('grants and takes back pages with a reason, writes the ledger and the audit log, never below zero', async () => {
    const admin = await asAdmin();
    const t = await makeUser(state.db, 'ogretmen@okul.k12.tr', 10);
    const call = (body: unknown) => userRoute.POST(post(`/api/admin/users/${t.id}`, body), ctx(t.id));

    expect((await call({ action: 'pages', delta: 50, note: '' })).status).toBe(400); // reason required
    const granted = await call({ action: 'pages', delta: 50, note: 'Okul pilotu' });
    expect(await granted.json()).toEqual({ ok: true, balance: 60 });
    expect((await call({ action: 'pages', delta: -70, note: 'Hatalı tanım' })).status).toBe(400);
    expect(await (await call({ action: 'pages', delta: -20, note: 'Hatalı tanım' })).json()).toEqual({ ok: true, balance: 40 });

    const rows = await state.db.select().from(ledger).where(eq(ledger.userId, t.id));
    expect(rows.map((r: any) => [r.reason, r.delta]).sort()).toEqual([['admin_debit', -20], ['admin_grant', 50]]);
    const log = await state.db.select().from(adminActions);
    expect(log.map((a: any) => [a.action, a.adminId, a.detail.note])).toEqual(expect.arrayContaining([
      ['pages.grant', admin.id, 'Okul pilotu'], ['pages.debit', admin.id, 'Hatalı tanım'],
    ]));
    const audit = await (await auditRoute.GET(get('/api/admin/audit'))).json();
    expect(audit.total).toBe(2);
  });

  it('suspending signs the teacher out at once; an admin cannot suspend or demote themself', async () => {
    const admin = await asAdmin();
    const adminCookie = state.cookie;
    const t = await makeUser(state.db);
    const teacherCookie = issueSession(t.id, 0);

    expect((await userRoute.POST(post(`/api/admin/users/${t.id}`, { action: 'suspend' }), ctx(t.id))).status).toBe(200);
    state.cookie = teacherCookie;
    expect((await meRoute.GET()).status).toBe(401);

    state.cookie = adminCookie;
    expect((await userRoute.POST(post(`/api/admin/users/${admin.id}`, { action: 'suspend' }), ctx(admin.id))).status).toBe(400);
    expect((await userRoute.POST(post(`/api/admin/users/${admin.id}`, { action: 'role', role: 'teacher' }), ctx(admin.id))).status).toBe(400);
    expect((await userRoute.POST(post(`/api/admin/users/${t.id}`, { action: 'role', role: 'admin' }), ctx(t.id))).status).toBe(200);
    const detail = await (await userRoute.GET(get(`/api/admin/users/${t.id}`), ctx(t.id))).json();
    expect(detail.user.role).toBe('admin');
    expect(detail.actions.map((a: any) => a.action)).toEqual(['user.role', 'user.suspend']);
  });

  it('lists teachers with search and filters', async () => {
    await asAdmin();
    await makeUser(state.db, 'ayse@okul.k12.tr', 0, { name: 'Ayşe Yılmaz' });
    await makeUser(state.db, 'mehmet@okul.k12.tr', 0, { emailVerifiedAt: null });
    const search = await (await usersRoute.GET(get('/api/admin/users?q=yılmaz'))).json();
    expect(search.rows.map((r: any) => r.email)).toEqual(['ayse@okul.k12.tr']);
    const unverified = await (await usersRoute.GET(get('/api/admin/users?filtre=unverified'))).json();
    expect(unverified.rows.map((r: any) => r.email)).toEqual(['mehmet@okul.k12.tr']);
  });

  it('closes a stuck exam; delivery refunds the reserved pages and tells the teacher', async () => {
    await asAdmin();
    const t = await makeUser(state.db, 'ogretmen@okul.k12.tr', 0);
    const [job] = await state.db.insert(jobs).values({
      userId: t.id, title: '9-A Fizik', status: 'processing', reservedPages: 3,
      submittedAt: new Date(Date.now() - 5 * 3_600_000),
    }).returning();
    await state.db.insert(pages).values({ jobId: job.id, kind: 'student', seq: 1, status: 'queued' });

    const stuck = await (await jobsRoute.GET(get('/api/admin/jobs?filtre=stuck'))).json();
    expect(stuck.rows.map((r: any) => r.id)).toEqual([job.id]);

    expect((await jobRoute.POST(post(`/api/admin/jobs/${job.id}`, { action: 'close' }), ctx(job.id))).status).toBe(400);
    expect((await jobRoute.POST(post(`/api/admin/jobs/${job.id}`, { action: 'close', note: 'Takıldı' }), ctx(job.id))).status).toBe(200);
    expect((await jobRoute.POST(post(`/api/admin/jobs/${job.id}`, { action: 'close', note: 'Takıldı' }), ctx(job.id))).status).toBe(409);
    const [closed] = await state.db.select().from(jobs).where(eq(jobs.id, job.id));
    expect([closed.status, closed.failReason]).toEqual(['failed', 'admin_closed']);
    const [page] = await state.db.select().from(pages).where(eq(pages.jobId, job.id));
    expect(page.status).toBe('failed');

    const mailer = fakeMailer();
    await deliverPending({ db: state.db, storage: memoryStorage(), mailer });
    const [u] = await state.db.select().from(users).where(eq(users.id, t.id));
    expect(u.pageBalance).toBe(3);
    expect(mailer.sent[0].text).toContain('destek ekibimiz tarafından kapatıldı');
    expect(mailer.sent[0].text).toContain('3 sayfa hakkı');
  });

  it('asks iyzico about one open payment and credits it once', async () => {
    const admin = await asAdmin();
    const t = await makeUser(state.db, 'ogretmen@okul.k12.tr', 0);
    const [p] = await state.db.insert(payments).values({
      userId: t.id, pack: 'baslangic', pages: 150, amountKurus: 5000, providerToken: 'tok-1',
    }).returning();
    const api = {
      initialize: async () => ({}),
      retrieve: async (req: any) => ({ status: 'success', paymentStatus: 'SUCCESS', basketId: req.conversationId, paidPrice: '50.00' }),
    };
    expect(await reconcileOne(state.db, api, admin, p.id)).toBe('paid');
    await expect(reconcileOne(state.db, api, admin, p.id)).rejects.toThrow('bekleyen');
    const [u] = await state.db.select().from(users).where(eq(users.id, t.id));
    expect(u.pageBalance).toBe(150);
  });

  it('overview adds up revenue, sign-ups and open exams', async () => {
    const t = await makeUser(state.db);
    await state.db.insert(payments).values({ userId: t.id, pack: 'ogretmen', pages: 200, amountKurus: 85000, status: 'paid', paidAt: new Date() });
    await state.db.insert(jobs).values({ userId: t.id, status: 'review', submittedAt: new Date() });
    const o = await overview(state.db);
    expect(o.revenue.d30).toEqual({ kurus: 85000, payments: 1 });
    expect(o.users).toMatchObject({ total: 1, paying: 1 });
    expect(o.jobs.open).toBe(1);
    expect(o.series).toHaveLength(30);
    expect(o.series.at(-1)).toMatchObject({ revenueKurus: 85000, signups: 1, jobs: 1 });
  });
});
