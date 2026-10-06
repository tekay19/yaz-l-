import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb, makeUser } from '../helpers/db';
import { jobs, ledger, pages, payments } from '@/db/schema';
import { issueSession } from '@/lib/auth/session';
import { normalizeDraft } from '@/lib/klasik/rubric';

const state = vi.hoisted(() => ({ db: null as any, token: undefined as string | undefined }));
vi.mock('@/db/client', () => ({ getDb: () => state.db }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name === 'so_user' && state.token ? { value: state.token } : undefined),
    set: () => {}, delete: () => {},
  }),
}));

import * as classesRoute from '@/app/api/classes/route';
import * as classRoute from '@/app/api/classes/[id]/route';
import * as settingsRoute from '@/app/api/me/settings/route';
import * as historyRoute from '@/app/api/me/history/route';
import * as resultsRoute from '@/app/api/jobs/[id]/results/route';
import * as reportRoute from '@/app/api/jobs/[id]/report/route';
import * as jobsRoute from '@/app/api/jobs/route';

process.env.SESSION_SECRET = 's'.repeat(40);

const req = (body?: unknown, method = 'POST', url = 'http://sinavoku.test/x') =>
  new Request(url, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function signIn(email = 'ogretmen@okul.k12.tr', balance = 10) {
  const u = await makeUser(state.db, email, balance);
  state.token = issueSession(u.id, 0);
  return u;
}

describe('a teacher\'s saved classes', () => {
  beforeEach(async () => { state.db = await testDb(); state.token = undefined; });

  it('saves, renames, edits and deletes a class, one name per line', async () => {
    expect((await classesRoute.GET()).status).toBe(401);
    await signIn();
    const made = await classesRoute.POST(req({ name: '9-A', students: 'Elif Yıldız\n Mert Kaya \nElif Yıldız\n\nZeynep Arslan\t1234' }));
    expect(made.status).toBe(201);
    const c = await made.json();
    expect(c.students).toEqual(['Elif Yıldız', 'Mert Kaya', 'Zeynep Arslan']); // duplicate and e-Okul number dropped
    expect((await classesRoute.POST(req({ name: '9-A', students: '' }))).status).toBe(409);
    expect((await classesRoute.POST(req({ name: '  ', students: '' }))).status).toBe(400);
    const renamed = await (await classRoute.PUT(req({ name: '9-B', students: 'Ali Can' }, 'PUT'), ctx(c.id))).json();
    expect([renamed.name, renamed.students]).toEqual(['9-B', ['Ali Can']]);
    expect((await (await classesRoute.GET()).json()).map((x: { name: string }) => x.name)).toEqual(['9-B']);
    expect((await classRoute.DELETE(req(), ctx(c.id))).status).toBe(204);
    expect((await classRoute.DELETE(req(), ctx(c.id))).status).toBe(404);
    expect((await classRoute.DELETE(req(), ctx('not-a-uuid'))).status).toBe(404);
  });

  it('never shows or changes another teacher\'s class', async () => {
    await signIn('a@okul.k12.tr');
    const c = await (await classesRoute.POST(req({ name: '9-A', students: 'Elif' }))).json();
    await signIn('b@okul.k12.tr');
    expect(await (await classesRoute.GET()).json()).toEqual([]);
    expect((await classRoute.PUT(req({ name: 'x' }, 'PUT'), ctx(c.id))).status).toBe(404);
    expect((await classRoute.DELETE(req(), ctx(c.id))).status).toBe(404);
  });
});

describe('settings', () => {
  beforeEach(async () => { state.db = await testDb(); state.token = undefined; });

  it('keeps a default style and note, and starts new klasik exams with the note', async () => {
    const u = await signIn();
    expect((await settingsRoute.PUT(req({ style: 'gevşek' }, 'PUT'))).status).toBe(400);
    expect(await (await settingsRoute.PUT(req({ style: 'lenient', note: ' Yazım hatalarını önemsemeyin. ' }, 'PUT'))).json())
      .toEqual({ style: 'lenient', note: 'Yazım hatalarını önemsemeyin.' });
    process.env.KLASIK_ENABLED = 'true';
    const { id } = await (await jobsRoute.POST(req({ title: '9-A', mode: 'klasik' }))).json();
    const [job] = await state.db.select().from(jobs).where(eq(jobs.id, id));
    expect([job.userId, job.teacherNote]).toEqual([u.id, 'Yazım hatalarını önemsemeyin.']);
    // the style starts the questions of a drafted rubric
    const draft = normalizeDraft({ questions: [{ q: 1, type: 'yorum', prompt: null, answer: 'a', workRequired: false, accepted: [],
      criteria: [{ text: 'a', points: 1, role: 'other', required: false }] }] }, [10], 'lenient');
    expect(draft.questions[0].policy.style).toBe('lenient');
    delete process.env.KLASIK_ENABLED;
  });
});

describe('balance history', () => {
  beforeEach(async () => { state.db = await testDb(); state.token = undefined; });

  it('lists packs bought with what was paid, pages used and given back, newest first', async () => {
    const u = await signIn();
    const [pay] = await state.db.insert(payments).values({ userId: u.id, pack: 'Başlangıç', pages: 150, amountKurus: 5000, status: 'paid' }).returning();
    const [job] = await state.db.insert(jobs).values({ userId: u.id, title: '9-A Matematik' }).returning();
    await state.db.insert(ledger).values([
      { userId: u.id, delta: 150, reason: 'purchase', ref: pay.id, createdAt: new Date('2026-10-01') },
      { userId: u.id, delta: -30, reason: 'job_reserve', ref: job.id, createdAt: new Date('2026-10-02') },
      { userId: u.id, delta: 2, reason: 'job_refund', ref: `${job.id}:closed`, createdAt: new Date('2026-10-03') },
    ]);
    const h = await (await historyRoute.GET()).json();
    expect(h.map((e: { label: string; delta: number; amountKurus: number | null }) => [e.label, e.delta, e.amountKurus])).toEqual([
      ['9-A Matematik — iade', 2, null],
      ['9-A Matematik', -30, null],
      ['Başlangıç paketi', 150, 5000],
    ]);
  });
});

describe('results and report downloads', () => {
  beforeEach(async () => { state.db = await testDb(); state.token = undefined; });

  async function optikDone(userId: string, status: 'draft' | 'done' = 'done') {
    const [job] = await state.db.insert(jobs).values({ userId, title: '9-A Test', status, roster: ['Elif Yıldız'] }).returning();
    await state.db.insert(pages).values([
      { jobId: job.id, kind: 'key', seq: 1, status: 'read', result: { type: 'key', read: { questionCount: 2, answers: [{ q: 1, option: 'A' }, { q: 2, option: 'B' }] } } },
      { jobId: job.id, kind: 'student', seq: 1, status: 'read', result: { type: 'student', read: {
        studentName: 'Elif Yıldız', nameConfidence: 'high', unreadable: false, isBackSide: false,
        answers: [{ q: 1, marked: ['A'], confidence: 'high' }, { q: 2, marked: ['C'], confidence: 'high' }],
      } } },
    ] as never);
    return job;
  }

  it('shows the class\'s results and hands out the report files', async () => {
    const u = await signIn();
    const job = await optikDone(u.id);
    const r = await (await resultsRoute.GET(req(undefined, 'GET'), ctx(job.id))).json();
    expect(r.rows.map((x: { student: string; correct: number; wrong: number }) => [x.student, x.correct, x.wrong])).toEqual([['Elif Yıldız', 1, 1]]);
    expect(r.questions.map((q: { q: number; rate: number }) => [q.q, q.rate])).toEqual([[1, 1], [2, 0]]);
    const xlsx = await reportRoute.GET(req(undefined, 'GET'), ctx(job.id));
    expect(xlsx.headers.get('content-type')).toContain('spreadsheetml');
    expect(xlsx.headers.get('content-disposition')).toContain(encodeURIComponent('9-A Test.xlsx'));
    const pdf = await reportRoute.GET(req(undefined, 'GET', 'http://sinavoku.test/x?format=pdf'), ctx(job.id));
    expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString()).toBe('%PDF');
  });

  it('has no results before the papers are read, and none for another teacher', async () => {
    const u = await signIn('a@okul.k12.tr');
    const draft = await optikDone(u.id, 'draft');
    expect((await resultsRoute.GET(req(undefined, 'GET'), ctx(draft.id))).status).toBe(409);
    expect((await reportRoute.GET(req(undefined, 'GET'), ctx(draft.id))).status).toBe(409);
    const done = await optikDone(u.id);
    await signIn('b@okul.k12.tr');
    expect((await resultsRoute.GET(req(undefined, 'GET'), ctx(done.id))).status).toBe(404);
    expect((await reportRoute.GET(req(undefined, 'GET'), ctx(done.id))).status).toBe(404);
  });
});
