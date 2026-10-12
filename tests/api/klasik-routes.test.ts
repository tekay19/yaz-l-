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
import * as scoredRoute from '@/app/api/jobs/[id]/rubric/scored/route';
import * as pageRoute from '@/app/api/jobs/[id]/pages/[pageId]/route';
import * as reviewRoute from '@/app/api/jobs/[id]/review/route';
import * as approveRoute from '@/app/api/jobs/[id]/approve/route';
import * as meRoute from '@/app/api/me/route';

process.env.SESSION_SECRET = 's'.repeat(40);

const ctx = (id: string, pageId?: string) => ({ params: Promise.resolve({ id, pageId: pageId ?? '' }) });
const req = (body?: unknown, method = 'POST') =>
  new Request('http://sinavoku.test/x', { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });

const equation = {
  q: 1, type: 'islem' as const, prompt: null, answer: 'x = 4', workRequired: true, accepted: [],
  criteria: [{ text: 'Kurulum', points: 1, role: 'other' as const, required: false }, { text: 'Sonuç', points: 1, role: 'result' as const, required: false }],
};
const rubric: Rubric = normalizeDraft({ questions: [equation] }, [10]);
const sheet = { type: 'klasik-student' as const, read: { isBackSide: false, studentName: 'Elif', nameConfidence: 'high' as const, unreadable: false,
  answers: [{ q: 1, lines: [{ text: 'x = (11 - 3) / 2 = 4', crossed: false }], unclear: false, hasFigure: false }] } };

async function signIn(email = 'ogretmen@okul.k12.tr') {
  const u = await makeUser(state.db, email, 10);
  state.token = issueSession(u.id, 0);
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
    expect([refused.status, (await refused.json()).error]).toEqual([400, 'Cevap anahtarında hiç soru bulunamadı.']);

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

  it('grades the others like the teacher: their own points become the question\'s examples', async () => {
    const u = await signIn();
    const job = await klasikJob(u.id, { status: 'review', rubric, rubricRev: 1, rubricApprovedAt: new Date(), roster: ['Elif', 'Mert'] });
    const other = { ...sheet, read: { ...sheet.read, studentName: 'Mert', answers: [{ q: 1, lines: [{ text: 'x = 3', crossed: false }], unclear: false, hasFigure: false }] } };
    const [a] = await state.db.insert(pages).values({ jobId: job.id, kind: 'student', seq: 1, status: 'read', result: sheet, gradedRev: 1 }).returning();
    await state.db.insert(pages).values({ jobId: job.id, kind: 'student', seq: 2, status: 'read', result: other, gradedRev: 1 });
    // nothing scored by hand yet: nothing to follow
    expect((await scoredRoute.POST(req({ q: 1 }), ctx(job.id))).status).toBe(400);
    expect((await pageRoute.PATCH(req({ points: [{ q: 1, points: 6 }] }, 'PATCH'), ctx(job.id, a.id))).status).toBe(200);
    const res = await scoredRoute.POST(req({ q: 1 }), ctx(job.id));
    expect([res.status, await res.json()]).toEqual([202, { examples: 1, questions: 1, regrading: 1, style: null }]); // one correction shows no direction
    const [after] = await state.db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(after.rubricRev).toBe(2);
    expect(after.rubric.questions[0]).toMatchObject({ rev: 2, scored: [{ text: 'x = (11 - 3) / 2 = 4', points: 6 }] });
    expect((await scoredRoute.POST(req({ q: 'bir' }), ctx(job.id))).status).toBe(400);
    // one question followed is not the whole class graded the teacher's way
    expect((await (await reviewRoute.GET(req(undefined, 'GET'), ctx(job.id))).json()).calibration.done).toBe(false);
    // after the first sheets: every question at once
    const all = await scoredRoute.POST(req({ all: true }), ctx(job.id));
    expect([all.status, await all.json()]).toEqual([202, { examples: 1, questions: 1, regrading: 1, style: null }]);
    const [again] = await state.db.select().from(jobs).where(eq(jobs.id, job.id));
    expect([again.rubricRev, again.rubric.questions[0].rev]).toEqual([3, 3]);
    expect(again.rubric.calibratedAt).toMatch(/^2\d{3}-/);
    expect((await (await reviewRoute.GET(req(undefined, 'GET'), ctx(job.id))).json()).calibration).toEqual({ sheets: [], done: true });
  });

  it('after the class is graded the teacher\'s way, shows the best answers of the questions without a full-credit example, then follows them', async () => {
    const u = await signIn();
    const partly = { questions: [{ q: 1, rev: 1, criteria: [{ id: 'c1', verdict: 'met', evidence: 'x = (11 - 3) / 2' }, { id: 'c2', verdict: 'partial', evidence: '= 4' }],
      resultCorrect: true, resultPath: 'valid', firstError: null, errorKind: null, flags: [], confidence: 'high', note: '', failed: false, textOnly: false }] };
    const job = await klasikJob(u.id, { status: 'review', rubric: { ...rubric, calibratedAt: '2026-10-12T11:00:00.000Z' }, rubricRev: 1, rubricApprovedAt: new Date(), roster: ['Elif', 'Mert', 'Ada'] });
    const ids: string[] = [];
    for (const [i, name] of ['Elif', 'Mert', 'Ada'].entries()) {
      const [p] = await state.db.insert(pages).values({ jobId: job.id, kind: 'student', seq: i + 1, status: 'read', gradedRev: 1, grade: partly,
        result: { ...sheet, read: { ...sheet.read, studentName: name } } }).returning();
      ids.push(p.id);
    }
    // the first sheet was checked at partial credit: no example of full marks yet
    expect((await pageRoute.PATCH(req({ points: [{ q: 1, points: 6 }] }, 'PATCH'), ctx(job.id, ids[0]))).status).toBe(200);
    const view = await (await reviewRoute.GET(req(undefined, 'GET'), ctx(job.id))).json();
    expect(view.bestAnswers).toEqual([{ q: 1, pageIds: [ids[1], ids[2]] }]);
    // one of them earns full marks from the teacher, and the question follows
    expect((await pageRoute.PATCH(req({ points: [{ q: 1, points: 10 }] }, 'PATCH'), ctx(job.id, ids[1]))).status).toBe(200);
    const res = await scoredRoute.POST(req({ qs: [1] }), ctx(job.id));
    expect([res.status, await res.json()]).toEqual([202, { examples: 2, questions: 1, regrading: 1, style: null }]);
    const [after] = await state.db.select().from(jobs).where(eq(jobs.id, job.id));
    expect([after.rubricRev, after.rubric.questions[0].rev]).toEqual([2, 2]);
    expect(after.rubric.bestAnswersAt).toMatch(/^2\d{3}-/);
    expect((await (await reviewRoute.GET(req(undefined, 'GET'), ctx(job.id))).json()).bestAnswers).toEqual([]);
  });

  it('the best-answers step can be skipped: nothing is graded again', async () => {
    const u = await signIn();
    const job = await klasikJob(u.id, { status: 'review', rubric: { ...rubric, calibratedAt: '2026-10-12T11:00:00.000Z' }, rubricRev: 1, rubricApprovedAt: new Date(), roster: ['Elif'] });
    const res = await scoredRoute.POST(req({ qs: [] }), ctx(job.id));
    expect([res.status, await res.json()]).toEqual([202, { examples: 0, questions: 0, regrading: 0, style: null }]);
    const [after] = await state.db.select().from(jobs).where(eq(jobs.id, job.id));
    expect([after.rubricRev, Boolean(after.rubric.bestAnswersAt)]).toEqual([1, true]);
    expect((await scoredRoute.POST(req({ qs: ['bir'] }), ctx(job.id))).status).toBe(400);
  });

  it('leaves a test question out of the whole-class follow, but follows it when asked for by itself', async () => {
    const u = await signIn();
    const withTest: Rubric = normalizeDraft({ questions: [
      equation,
      { q: 2, type: 'kisa', prompt: null, answer: 'B', workRequired: false, accepted: [], criteria: [{ text: 'Doğru seçeneği (B) belirtir', points: 1, role: 'other', required: false }] },
    ] }, [10, 1]);
    const job = await klasikJob(u.id, { status: 'review', rubric: withTest, rubricRev: 1, rubricApprovedAt: new Date(), roster: ['Elif'] });
    const both = { ...sheet, read: { ...sheet.read, answers: [...sheet.read.answers, { q: 2, lines: [{ text: 'B', crossed: false }], unclear: false, hasFigure: false }] } };
    const [a] = await state.db.insert(pages).values({ jobId: job.id, kind: 'student', seq: 1, status: 'read', result: both, gradedRev: 1 }).returning();
    expect((await pageRoute.PATCH(req({ points: [{ q: 1, points: 6 }, { q: 2, points: 1 }] }, 'PATCH'), ctx(job.id, a.id))).status).toBe(200);
    const all = await scoredRoute.POST(req({ all: true }), ctx(job.id));
    expect([all.status, await all.json()]).toEqual([202, { examples: 1, questions: 1, regrading: 0, style: null }]);
    const [after] = await state.db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(after.rubric.questions[0]).toMatchObject({ rev: 2, scored: [{ text: 'x = (11 - 3) / 2 = 4', points: 6 }] });
    expect(after.rubric.questions[1]).toMatchObject({ rev: 1 });
    expect(after.rubric.questions[1].scored).toBeUndefined();
    const one = await scoredRoute.POST(req({ q: 2 }), ctx(job.id));
    expect([one.status, await one.json()]).toEqual([202, { examples: 1, questions: 1, regrading: 0, style: null }]);
    const [again] = await state.db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(again.rubric.questions[1]).toMatchObject({ rev: 2, scored: [{ text: 'B', points: 1 }] });
  });

  it('shows which sheets to check first until the teacher\'s way is applied', async () => {
    const u = await signIn();
    const job = await klasikJob(u.id, { status: 'review', rubric, rubricRev: 1, roster: ['Elif', 'Mert', 'Ada', 'Can'] });
    for (const [i, name] of ['Elif', 'Mert', 'Ada', 'Can'].entries()) {
      await state.db.insert(pages).values({ jobId: job.id, kind: 'student', seq: i + 1, status: 'read', gradedRev: 1,
        result: { ...sheet, read: { ...sheet.read, studentName: name } } });
    }
    const view = await (await reviewRoute.GET(req(undefined, 'GET'), ctx(job.id))).json();
    expect(view.calibration.done).toBe(false);
    expect(view.calibration.sheets).toHaveLength(3);
    expect((await scoredRoute.POST(req({ all: true }), ctx(job.id))).status).toBe(400); // nothing checked yet
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
