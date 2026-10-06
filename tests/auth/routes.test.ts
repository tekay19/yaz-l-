import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb, makeUser } from '../helpers/db';
import { users } from '@/db/schema';
import { issueSession } from '@/lib/auth/session';

const APP = 'https://sinavoku.test';
const state = vi.hoisted(() => ({ db: null as any, cookie: undefined as string | undefined, mail: [] as any[] }));
vi.mock('@/db/client', () => ({ getDb: () => state.db }));
vi.mock('@/lib/mail', () => ({ getMailer: () => ({ send: async (m: any) => { state.mail.push(m); } }) }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name === 'so_user' && state.cookie ? { value: state.cookie } : undefined),
    set: (name: string, value: string) => { if (name === 'so_user') state.cookie = value; },
    delete: (name: string) => { if (name === 'so_user') state.cookie = undefined; },
  }),
}));

import * as registerRoute from '@/app/api/auth/register/route';
import * as loginRoute from '@/app/api/auth/login/route';
import * as logoutRoute from '@/app/api/auth/logout/route';
import * as verifyRoute from '@/app/api/auth/verify/route';
import * as meRoute from '@/app/api/me/route';
import * as jobsRoute from '@/app/api/jobs/route';

process.env.SESSION_SECRET = 's'.repeat(40);
process.env.APP_URL = APP;

let ip = 0;
// every test call comes from its own IP so the throttles stay out of the way
const post = (body: unknown, origin = APP) => new Request(`${APP}/x`, {
  method: 'POST', body: JSON.stringify(body),
  headers: { 'content-type': 'application/json', origin, 'x-forwarded-for': `10.0.0.${++ip}` },
});
const GOOD = 'tebeşir2026';

describe('sign-up and sign-in routes', () => {
  beforeEach(async () => { state.db = await testDb(); state.cookie = undefined; state.mail = []; });

  it('signs up, signs in right away, but cannot open an exam before verifying', async () => {
    const res = await registerRoute.POST(post({ name: 'Ayşe Yılmaz', email: 'ayse@okul.k12.tr', password: GOOD }));
    expect(res.status).toBe(201);
    expect(state.cookie).toBeTruthy();
    const me = await (await meRoute.GET()).json();
    expect(me).toMatchObject({ email: 'ayse@okul.k12.tr', name: 'Ayşe Yılmaz', verified: false, role: 'teacher' });

    const blocked = await jobsRoute.POST(post({ title: 'Deneme' }));
    expect(blocked.status).toBe(403);
    expect((await blocked.json()).code).toBe('unverified');

    const token = /token=([A-Za-z0-9_-]+)/.exec(state.mail[0].text)![1];
    expect((await verifyRoute.POST(post({ token }))).status).toBe(200);
    expect((await jobsRoute.POST(post({ title: 'Deneme' }))).status).toBe(201);
  });

  it('refuses a sign-in posted from another site before checking anything', async () => {
    await registerRoute.POST(post({ name: 'Ayşe Yılmaz', email: 'ayse@okul.k12.tr', password: GOOD }));
    state.cookie = undefined;
    const res = await loginRoute.POST(post({ email: 'ayse@okul.k12.tr', password: GOOD }, 'https://evil.example'));
    expect(res.status).toBe(403);
    expect(state.cookie).toBeUndefined();
  });

  it('wrong password → 401 with no cookie; right one → cookie; logout clears it', async () => {
    await registerRoute.POST(post({ name: 'Ayşe Yılmaz', email: 'ayse@okul.k12.tr', password: GOOD }));
    await logoutRoute.POST();
    expect(state.cookie).toBeUndefined();
    expect((await loginRoute.POST(post({ email: 'ayse@okul.k12.tr', password: 'yanlış2026x' }))).status).toBe(401);
    expect(state.cookie).toBeUndefined();
    expect((await loginRoute.POST(post({ email: 'AYSE@okul.k12.tr', password: GOOD }))).status).toBe(200);
    expect((await meRoute.GET()).status).toBe(200);
  });

  it('locks one address after repeated wrong passwords, whatever the IP', async () => {
    await makeUser(state.db, 'hedef@okul.k12.tr');
    for (let i = 0; i < 8; i++) await loginRoute.POST(post({ email: 'hedef@okul.k12.tr', password: `yanlis${i}xxxxx` }));
    expect((await loginRoute.POST(post({ email: 'hedef@okul.k12.tr', password: 'yine0yanlis' }))).status).toBe(429);
  });

  it('a cookie stops working once the session version moves or the account is suspended', async () => {
    const u = await makeUser(state.db);
    state.cookie = issueSession(u.id, 0);
    expect((await meRoute.GET()).status).toBe(200);
    await state.db.update(users).set({ sessionVersion: 1 }).where(eq(users.id, u.id));
    expect((await meRoute.GET()).status).toBe(401);
    state.cookie = issueSession(u.id, 1);
    await state.db.update(users).set({ suspendedAt: new Date() }).where(eq(users.id, u.id));
    expect((await meRoute.GET()).status).toBe(401);
  });
});
