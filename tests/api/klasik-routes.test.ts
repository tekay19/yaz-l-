import { beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { testDb, makeUser } from '../helpers/db';
import { jobs, pages } from '@/db/schema';
import { issueSession } from '@/lib/auth/session';
import { normalizeDraft } from '@/lib/klasik/rubric';
import type { Rubric } from '@/lib/types';

// Route handlers read the session through next/headers and the DB through
// getDb(); both are pointed at the test's own copies here.
const state = vi.hoisted(() => ({ db: null as any, token: undefined as string | undefined }));
vi.mock('@/db/client', () => ({ getDb: () => state.db }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name === 'so_user' && state.token ? { value: state.token } : undefined),
    set: () => {}, delete: () => {},
  }),
}));

import * as keyText from '@/app/api/jobs/[id]/key-text/route';
import * as rubricRoute from '@/app/api/jobs/[id]/rubric/route';
import * as approveRubricRoute from '@/app/api/jobs/[id]/rubric/approve/route';
import * as acceptRoute from '@/app/api/jobs/[id]/rubric/accept/route';
import * as pageRoute from '@/app/api/jobs/[id]/pages/[pageId]/route';
import * as reviewRoute from '@/app/api/jobs/[id]/review/route';
import * as approveRoute from '@/app/api/jobs/[id]/approve/route';
import * as meRoute from '@/app/api/me/route';

process.env.SESSION_SECRET = 's'.repeat(40);

const ctx = (id: string, pageId?: string) => ({ params: Promise.resolve({ id, pageId: pageId ?? '' }) });
const req = (body?: unknown, method = 'POST') =>
  new Request('http://sinavoku.test/x', { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });

const rubric: Rubric = normalizeDraft({ questions: [
  { q: 1, type: 'islem', prompt: null, answer: 'x = 4', workRequired: true, accepted: [],
    criteria: [{ text: 'Kurulum', points: 1, role: 'other', required: false }, { text: 'Sonuç', points: 1, role: 'result', required: false }] },
] }, [10]);
const sheet = { type: 'klasik-student' as const, read: { isBackSide: false, studentName: 'Elif', nameConfidence: 'high' as const, unreadable: false,
  answers: [{ q: 1, lines: [{ text: 'x = (11 - 3) / 2 = 4', crossed: false }], unclear: false, hasFigure: false }] } };

async function signIn(email = 'ogretmen@okul.k12.tr') {
  const u = await makeUser(state.db, email, 10);
  state.token = issueSession(u.id);
  return u;
}
async function klasikJob(userId: string, over: Partial<typeof jobs.$inferInsert> = {}) {
  const [job] = await state.db.insert(jobs).values({ userId, mode: 'klasik', title: '10-A', ...over }).returning();
  return job as typeof jobs.$inferSelect;
}

describe('klasik routes', () => {
  beforeEach(async () => {
    state.db = await testDb();
    state.token = undefined;
    delete process.env.KLASIK_ENABLED;
  });

  it('answers only to the owner, and only for klasik jobs', async () => {
    const owner = await makeUser(state.db, 'sahip@okul.k12.tr', 0);
    const job = await klasikJob(owner.id, { status: 'rubric', rubric });
    expect((await rubricRoute.GET(req(), ctx(job.id))).status).toBe(401);
    const other = await signIn('baska@okul.k12.tr');
    expect((await rubricRoute.GET(req(), ctx(job.id))).status).toBe(404);
    const optik = await klasikJob(other.id, { mode: 'optik' });
    expect((await rubricRoute.GET(req(), ctx(optik.id))).status).toBe(404);
  });

  it('takes a typed key while the job is a draft, and not once it is sent', async () => {
    const u = await signIn();
    const job = await klasikJob(u.id);
    expect((await keyText.PUT(req({ text: '1) x = 4' }, 'PUT'), ctx(job.id))).status).toBe(200);
    expect((await state.db.select().from(jobs).where(eq(jobs.id, job.id)))[0].keyText).toBe('1) x = 4');
    await state.db.update(jobs).set({ status: 'queued' }).where(eq(jobs.id, job.id));
    const late = await keyText.PUT(req({ text: 'x' }, 'PUT'), ctx(job.id));
    expect(late.status).toBe(409);
    expect((await late.json()).error).toBe('Bu aşamada anahtar değiştirilemez.');
  });

  it('edits and approves a rubric, and refuses a broken one', async () => {
    const u = await signIn();
    const job = await klasikJob(u.id, { status: 'rubric', rubric });
    const view = await (await rubricRoute.GET(req(), ctx(job.id))).json();
    expect(view).toMatchObject({ status: 'rubric', approved: false, problems: [], rubric: { questions: [{ q: 1 }] } });

    const q = rubric.questions[0];
    const dup = await rubricRoute.PUT(req({ questions: [q, q] }, 'PUT'), ctx(job.id));
    expect([dup.status, (await dup.json()).error]).toEqual([400, 'Aynı soru numarası iki kez var.']);
    const zero = await rubricRoute.PUT(req({ questions: [{ ...q, criteria: [{ ...q.criteria[0], points: 0 }] }] }, 'PUT'), ctx(job.id));
    expect(zero.status).toBe(400);
    const edited = { questions: [{ ...q, criteria: [{ ...q.criteria[0], text: 'Denklemi kurar' }, q.criteria[1]] }] };
    expect((await rubricRoute.PUT(req(edited, 'PUT'), ctx(job.id))).status).toBe(200);

    const empty = await klasikJob(u.id, { status: 'rubric', rubric: { questions: [] } });
    const refused = await approveRubricRoute.POST(req(), ctx(empty.id));
    expect([refused.status, (await refused.json()).error]).toEqual([400, 'Rubrikte hiç soru yok.']);

    expect((await approveRubricRoute.POST(req(), ctx(job.id))).status).toBe(202);
    const [after] = await state.db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(after).toMatchObject({ status: 'processing', rubricRev: 1 });
    expect(after.rubric.questions[0].criteria[0].text).toBe('Denklemi kurar');
    expect((await approveRubricRoute.POST(req(), ctx(job.id))).status).toBe(409);
  });

  it('corrects a klasik sheet, accepts an answer into the rubric and waits for the re-grade before approval', async () => {
    const u = await signIn();
    const job = await klasikJob(u.id, { status: 'review', rubric, rubricRev: 1, rubricApprovedAt: new Date() });
    const [page] = await state.db.insert(pages).values({ jobId: job.id, kind: 'student', seq: 1, status: 'read', result: sheet, gradedRev: 1,
      grade: { questions: [{ q: 1, rev: 1, criteria: [], resultCorrect: true, resultPath: 'valid', firstError: null, errorKind: null, flags: [], confidence: 'high', note: '', failed: false, textOnly: false }] } }).returning();

    expect((await pageRoute.PATCH(req({ points: [{ q: 1, points: 'ten' }] }, 'PATCH'), ctx(job.id, page.id))).status).toBe(400);
    expect((await pageRoute.PATCH(req({ points: [{ q: 9, points: 1 }] }, 'PATCH'), ctx(job.id, page.id))).status).toBe(400);
    expect((await pageRoute.PATCH(req({ points: [{ q: 1, points: 7 }] }, 'PATCH'), ctx(job.id, page.id))).status).toBe(200);
    let [row] = await state.db.select().from(pages).where(eq(pages.id, page.id));
    expect(row.override.points).toEqual([{ q: 1, points: 7 }]);

    // a fixed transcription sends that question back for grading
    expect((await pageRoute.PATCH(req({ texts: [{ q: 1, text: 'x = 4' }], points: [{ q: 1, points: null }] }, 'PATCH'), ctx(job.id, page.id))).status).toBe(200);
    [row] = await state.db.select().from(pages).where(eq(pages.id, page.id));
    expect(row).toMatchObject({ gradedRev: 0, grade: { questions: [] } });
    expect(row.override).toMatchObject({ points: [], texts: [{ q: 1, text: 'x = 4' }] });

    const accepted = await acceptRoute.POST(req({ pageId: page.id, q: 1, note: 'Kısa yol da doğru' }), ctx(job.id));
    expect(accepted.status).toBe(202);
    const [after] = await state.db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(after.rubricRev).toBe(2);
    expect(after.rubric.questions[0]).toMatchObject({ rev: 2, accepted: [{ text: 'Kısa yol da doğru', example: 'x = 4', by: 'teacher' }] });

    const early = await approveRoute.POST(req(), ctx(job.id));
    expect([early.status, (await early.json()).error]).toEqual([409, 'Yeniden puanlama sürüyor; birkaç saniye sonra tekrar deneyin.']);
    await state.db.update(pages).set({ gradedRev: 2 }).where(and(eq(pages.jobId, job.id), eq(pages.kind, 'student')));
    expect((await approveRoute.POST(req(), ctx(job.id))).status).toBe(202);
  });

  it('shows the klasik review screen', async () => {
    const u = await signIn();
    const job = await klasikJob(u.id, { status: 'review', rubric, rubricRev: 1, roster: ['Elif Yılmaz'] });
    await state.db.insert(pages).values({ jobId: job.id, kind: 'student', seq: 1, status: 'read', result: sheet, filePath: 'jobs/a/b.jpg', gradedRev: 1,
      grade: { questions: [{ q: 1, rev: 1, criteria: [{ id: 'c1', verdict: 'met', evidence: 'x = (11 - 3) / 2' }, { id: 'c2', verdict: 'met', evidence: '= 4' }],
        resultCorrect: true, resultPath: 'valid', firstError: null, errorKind: null, flags: ['alternative_path'], confidence: 'high', note: 'Farklı ama geçerli yol.', failed: false, textOnly: false }] } });
    const view = await (await reviewRoute.GET(req(), ctx(job.id))).json();
    expect(view).toMatchObject({ mode: 'klasik', pending: 0, failed: [] });
    const [s] = view.sheets;
    expect(s).toMatchObject({ total: 10, max: 10, percent: 100, attention: 0, nameFlags: ['İsim sınıf listesinde yok'] });
    expect(s.imageUrls).toEqual([`/api/jobs/${job.id}/pages/${s.pageId}`]);
    expect(s.questions[0]).toMatchObject({ points: 10, status: 'graded', note: 'Farklı ama geçerli yol.',
      notes: [{ code: 'alternative_path', text: 'Anahtardan farklı bir yöntem', attention: false }] });
  });

  it('tells the front end whether klasik exams are on', async () => {
    await signIn();
    expect((await (await meRoute.GET()).json()).klasik).toBe(false);
    process.env.KLASIK_ENABLED = 'true';
    expect((await (await meRoute.GET()).json()).klasik).toBe(true);
  });
});
