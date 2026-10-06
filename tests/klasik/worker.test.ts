import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { testDb, makeUser } from '../helpers/db';
import { memoryStorage } from '../helpers/storage';
import { fakeMailer } from '../helpers/mail';
import { fakeReader, usage } from '../helpers/reader';
import { addPage, createJob } from '@/lib/jobs/pages';
import { submitJob } from '@/lib/jobs/submit';
import { claimPages, FIRST_RETRY_MS, LEASE_MS, RETRY_BACKOFF_MS } from '@/lib/queue';
import { processPage } from '@/worker/process';
import { autoDeliverStale, deliverPending } from '@/lib/jobs/deliver';
import { completeKlasikJobs, draftPendingRubrics, expireRubrics, gradePending, RUBRIC_RETRY_MS } from '@/lib/klasik/worker';
import { notifyRubric } from '@/lib/klasik/notify';
import { amendRubric } from '@/lib/klasik/rubric';
import { jobs, pages, users } from '@/db/schema';
import type { Reader } from '@/lib/reader/types';
import type { GradeOutput, RubricDraft } from '@/lib/reader/schemas';
import type { KlasikAnswer, KlasikRead, RubricQuestion } from '@/lib/types';

const ln = (...t: string[]) => t.map((text) => ({ text, crossed: false }));
const PAGES: Record<string, KlasikRead> = {
  key: { isBackSide: false, studentName: null, nameConfidence: 'high', unreadable: false, answers: [
    { q: 1, lines: ln('2x + 3 = 11', 'x = 4'), unclear: false, hasFigure: false },
    { q: 2, lines: ln('Lirik şiir duyguyu anlatır'), unclear: false, hasFigure: false },
  ] },
  front1: { isBackSide: false, studentName: 'Elif Yılmaz', nameConfidence: 'high', unreadable: false, answers: [
    { q: 1, lines: ln('2x = 8', 'x = 4'), unclear: false, hasFigure: false },
  ] },
  back1: { isBackSide: true, studentName: null, nameConfidence: 'low', unreadable: false, answers: [
    { q: 2, lines: ln('Şair duygularını anlatır'), unclear: false, hasFigure: false },
  ] },
  bad: { isBackSide: false, studentName: null, nameConfidence: 'low', unreadable: true, answers: [] },
  front2: { isBackSide: false, studentName: 'Mert Kaya', nameConfidence: 'high', unreadable: false, answers: [
    { q: 1, lines: ln('x = 4'), unclear: false, hasFigure: false },
    { q: 2, lines: ln('Duygu'), unclear: false, hasFigure: false },
  ] },
  figure: { isBackSide: false, studentName: 'Ada Su', nameConfidence: 'high', unreadable: false, answers: [
    { q: 1, lines: ln('Şekil: sayı doğrusu', 'x = 4'), unclear: false, hasFigure: true },
  ] },
  blankkey: { isBackSide: false, studentName: null, nameConfidence: 'high', unreadable: false, answers: [] },
};
const DRAFT: RubricDraft = { questions: [
  { q: 1, type: 'islem', prompt: '2x + 3 = 11', answer: 'x = 4', workRequired: true, accepted: ['x = (11 - 3) / 2'],
    criteria: [{ text: 'Kurulum', points: 2, role: 'other', required: false }, { text: 'Sonuç', points: 3, role: 'result', required: false }] },
  { q: 2, type: 'yorum', prompt: null, answer: 'Duygu ön planda', workRequired: false, accepted: [],
    criteria: [{ text: 'Duyguyu açıklar', points: 1, role: 'other', required: false }] },
] };

// Grades whatever it is asked for as fully met, quoting the answer's first line.
function gradeAll(questions: RubricQuestion[], answers: KlasikAnswer[]): GradeOutput {
  return { questions: questions.map((rq) => {
    const first = answers.find((a) => a.q === rq.q)?.lines.find((l) => !l.crossed)?.text ?? '';
    const last = answers.find((a) => a.q === rq.q)?.lines.at(-1)?.text ?? '';
    return {
      q: rq.q, criteria: rq.criteria.map((c) => ({ id: c.id, verdict: 'met' as const, evidence: c.role === 'result' ? last : first, slipOnly: false })),
      resultCorrect: rq.type === 'yorum' ? null : true, resultPath: rq.type === 'yorum' ? null : 'valid' as const,
      firstError: null, errorKind: null, flags: [], confidence: 'high' as const, note: 'Doğru.',
    };
  }) };
}

function reader(over: Partial<Reader> = {}, calls: { grade: { qs: number[]; images: number }[]; draft: string[] } = { grade: [], draft: [] }) {
  return Object.assign(fakeReader({
    readKlasik: async (image) => ({ read: PAGES[image.toString()], usage }),
    draftRubric: async ({ keyText }) => { calls.draft.push(keyText); return { read: DRAFT, usage }; },
    gradeKlasik: async ({ questions, answers, images }) => {
      calls.grade.push({ qs: questions.map((q) => q.q), images: images.length });
      return { read: gradeAll(questions, answers), usage };
    },
    ...over,
  }), { calls });
}

async function submitted(opts: { key?: string; keyText?: string; students: string[]; balance?: number }) {
  const db = await testDb();
  const storage = memoryStorage();
  const u = await makeUser(db, 'ogretmen@okul.k12.tr', opts.balance ?? 20);
  const { id } = await createJob(db, u.id, { title: '10-A Karma', mode: 'klasik', klasikMax: [10, 5] });
  if (opts.keyText) await db.update(jobs).set({ keyText: opts.keyText }).where(eq(jobs.id, id));
  if (opts.key) await addPage(db, storage, { jobId: id, kind: 'key', image: Buffer.from(opts.key) });
  for (const s of opts.students) await addPage(db, storage, { jobId: id, kind: 'student', image: Buffer.from(s) });
  expect((await submitJob(db, id, u.id, true, true)).ok).toBe(true);
  return { db, storage, u, id };
}

async function drain(db: any, storage: any, r: Reader) {
  for (let batch = await claimPages(db, 10); batch.length; batch = await claimPages(db, 10)) {
    for (const p of batch) await processPage({ db, storage, reader: r }, p);
  }
}
const jobRow = async (db: any, id: string) => (await db.select().from(jobs).where(eq(jobs.id, id)))[0];
const approve = (db: any, id: string) =>
  db.update(jobs).set({ rubricApprovedAt: new Date(), rubricRev: 1, status: 'processing' }).where(eq(jobs.id, id));

describe('klasik worker', () => {
  it('reads every page at once, drafts the rubric from the key and waits for the teacher', async () => {
    const { db, storage, id } = await submitted({ key: 'key', students: ['front1', 'back1'] });
    const r = reader();
    await drain(db, storage, r);
    expect((await db.select().from(pages)).every((p) => p.status === 'read')).toBe(true);

    expect(await draftPendingRubrics({ db, storage, reader: r })).toBe(1);
    const job = await jobRow(db, id);
    expect(job.status).toBe('rubric');
    expect(job.rubricReadyAt).not.toBeNull();
    expect(job.rubric.questions.map((q: RubricQuestion) => [q.q, q.criteria.map((c) => c.points)])).toEqual([[1, [4, 6]], [2, [5]]]);
    expect(r.calls.draft[0]).toBe('1. soru:\n2x + 3 = 11\nx = 4\n\n2. soru:\nLirik şiir duyguyu anlatır');

    const mailer = fakeMailer();
    expect(await notifyRubric({ db, mailer })).toBe(1);
    expect(mailer.sent[0].subject).toBe('10-A Karma: puanlama ölçütlerini onaylayın');
    expect(await notifyRubric({ db, mailer })).toBe(0);
    // nothing is graded before the teacher approves the rubric
    expect(await gradePending({ db, storage, reader: r }, 10)).toBe(0);
  });

  it('drafts from a typed key alone, and hands over an empty rubric when nothing is readable', async () => {
    const typed = await submitted({ keyText: '1) x = 4', students: ['front1'] });
    const r = reader();
    await drain(typed.db, typed.storage, r);
    await draftPendingRubrics({ ...typed, reader: r });
    expect((await jobRow(typed.db, typed.id)).rubric.questions).toHaveLength(2);
    expect(r.calls.draft).toEqual(['1) x = 4']);

    const blank = await submitted({ key: 'blankkey', students: ['front1'] });
    const r2 = reader();
    await drain(blank.db, blank.storage, r2);
    expect((await blank.db.select().from(pages).where(eq(pages.kind, 'key')))[0]).toMatchObject({ status: 'failed', error: 'key_empty' });
    await draftPendingRubrics({ ...blank, reader: r2 });
    expect(await jobRow(blank.db, blank.id)).toMatchObject({ status: 'rubric', rubric: { questions: [] } });
    expect(r2.calls.draft).toEqual([]);
    const mailer = fakeMailer();
    await notifyRubric({ db: blank.db, mailer });
    expect(mailer.sent[0].text).toContain('Cevap anahtarınız okunamadı');
  });

  it('gives up drafting after three failures and lets the teacher build the rubric', async () => {
    const { db, storage, id } = await submitted({ key: 'key', students: ['front1'] });
    const r = reader({ draftRubric: async () => { throw new Error('overloaded'); } });
    await drain(db, storage, r);
    const t0 = Date.now();
    for (let i = 0; i < 3; i++) await draftPendingRubrics({ db, storage, reader: r }, new Date(t0 + i * (RUBRIC_RETRY_MS + 1000)));
    expect(await jobRow(db, id)).toMatchObject({ status: 'rubric', rubric: { questions: [] }, rubricDraftAttempts: 3 });
  });

  it('grades each sheet once the rubric is approved, then waits in review with unread pages refunded', async () => {
    const { db, storage, u, id } = await submitted({ key: 'key', students: ['front1', 'back1', 'bad', 'front2'], balance: 4 });
    const r = reader();
    await drain(db, storage, r);
    await draftPendingRubrics({ db, storage, reader: r });
    await approve(db, id);
    expect(await gradePending({ db, storage, reader: r }, 10)).toBe(2);
    expect(r.calls.grade).toEqual([{ qs: [1, 2], images: 0 }, { qs: [1, 2], images: 0 }]);
    expect(await completeKlasikJobs(db)).toBe(1);
    expect((await jobRow(db, id)).status).toBe('review');
    expect((await db.select().from(users).where(eq(users.id, u.id)))[0].pageBalance).toBe(1); // 'bad' came back
    const rows = await db.select().from(pages).where(eq(pages.kind, 'student'));
    expect(rows.filter((p) => p.status === 'read').every((p) => p.gradedRev === 1)).toBe(true);
    expect(rows.find((p) => p.seq === 1)!.grade!.questions.map((g) => g.q)).toEqual([1, 2]);
    expect(await gradePending({ db, storage, reader: r }, 10)).toBe(0);
  });

  it('re-grades only the question whose rubric changed, and not where the teacher set the points', async () => {
    const { db, storage, id } = await submitted({ key: 'key', students: ['front1', 'back1', 'front2'] });
    const r = reader();
    await drain(db, storage, r);
    await draftPendingRubrics({ db, storage, reader: r });
    await approve(db, id);
    await gradePending({ db, storage, reader: r }, 10);
    await completeKlasikJobs(db);
    // the teacher settles question 2 on Mert's sheet by hand, then accepts an answer for question 2
    await db.update(pages).set({ override: { points: [{ q: 2, points: 5 }] } }).where(and(eq(pages.jobId, id), eq(pages.seq, 3)));
    const job = await jobRow(db, id);
    await db.update(jobs).set({ rubric: amendRubric(job.rubric, 2, { text: 'kabul', example: 'Duygu', by: 'teacher' }), rubricRev: 2 }).where(eq(jobs.id, id));
    r.calls.grade.length = 0;
    expect(await gradePending({ db, storage, reader: r }, 10)).toBe(2);
    expect(r.calls.grade).toEqual([{ qs: [2], images: 0 }]); // Mert's sheet had nothing left to grade
    const elif = (await db.select().from(pages).where(and(eq(pages.jobId, id), eq(pages.kind, 'student'), eq(pages.seq, 1))))[0];
    expect(elif.grade!.questions.map((g) => [g.q, g.rev])).toEqual([[1, 1], [2, 2]]);
    expect((await db.select().from(pages).where(eq(pages.kind, 'student'))).every((p) => p.gradedRev === 2)).toBe(true);
  });

  it('retries a grade that skips a question and gives up after three tries', async () => {
    const { db, storage, id } = await submitted({ key: 'key', students: ['front2'] });
    const partial = reader({ gradeKlasik: async ({ questions, answers }) => {
      const out = gradeAll(questions, answers);
      return { read: { questions: out.questions.slice(0, 1) }, usage };
    } });
    await drain(db, storage, partial);
    await draftPendingRubrics({ db, storage, reader: partial });
    await approve(db, id);
    const t0 = Date.now();
    await gradePending({ db, storage, reader: partial }, 10, new Date(t0));
    expect(await gradePending({ db, storage, reader: partial }, 10, new Date(t0 + 1000))).toBe(0); // backing off
    await gradePending({ db, storage, reader: partial }, 10, new Date(t0 + FIRST_RETRY_MS + 1000));
    await gradePending({ db, storage, reader: partial }, 10, new Date(t0 + FIRST_RETRY_MS + RETRY_BACKOFF_MS + 2000));
    const [sheet] = await db.select().from(pages).where(eq(pages.kind, 'student'));
    expect(sheet.grade!.questions.map((g) => [g.q, g.failed])).toEqual([[1, true], [2, true]]);
    expect(await completeKlasikJobs(db)).toBe(1);
  });

  it('drops a late grade from a worker whose lease ran out', async () => {
    const { db, storage, id } = await submitted({ key: 'key', students: ['front2'] });
    let release!: () => void;
    const slow = reader({ gradeKlasik: async ({ questions, answers }) => {
      await new Promise<void>((resolve) => { release = resolve; });
      const out = gradeAll(questions, answers);
      out.questions[0].note = 'slow';
      return { read: out, usage };
    } });
    await drain(db, storage, slow);
    await draftPendingRubrics({ db, storage, reader: slow });
    await approve(db, id);
    const t0 = Date.now();
    const first = gradePending({ db, storage, reader: slow }, 10, new Date(t0));
    await new Promise((r) => setTimeout(r, 50));
    await gradePending({ db, storage, reader: reader() }, 10, new Date(t0 + LEASE_MS + 1000)); // takes the sheet over
    release();
    await first;
    const [sheet] = await db.select().from(pages).where(eq(pages.kind, 'student'));
    expect(sheet.grade!.questions[0].note).toBe('Doğru.');
  });

  it('drops a grade of the old text when the teacher edits the sheet mid-grading', async () => {
    const { db, storage, id } = await submitted({ key: 'key', students: ['front2'] });
    const held: (() => void)[] = [];
    const slow = (note: string) => reader({ gradeKlasik: async ({ questions, answers }) => {
      await new Promise<void>((resolve) => { held.push(resolve); });
      const out = gradeAll(questions, answers);
      out.questions[0].note = note;
      return { read: out, usage };
    } });
    await drain(db, storage, reader());
    await draftPendingRubrics({ db, storage, reader: reader() });
    await approve(db, id);
    const t0 = Date.now();
    const first = gradePending({ db, storage, reader: slow('old text') }, 10, new Date(t0));
    await new Promise((r) => setTimeout(r, 50));
    // what saving a fixed transcription does: the sheet is graded afresh
    await db.update(pages).set({ gradedRev: 0, gradeAttempts: 0, gradeLeaseUntil: null }).where(eq(pages.kind, 'student'));
    const second = gradePending({ db, storage, reader: slow('new text') }, 10, new Date(t0 + 1000));
    await new Promise((r) => setTimeout(r, 50));
    held[0]();
    await first;
    held[1]();
    await second;
    const [sheet] = await db.select().from(pages).where(eq(pages.kind, 'student'));
    expect(sheet.grade!.questions[0].note).toBe('new text');
  });

  it('judges a figure from its photo, or from the text once the photo is gone', async () => {
    const { db, storage, id } = await submitted({ key: 'key', students: ['figure'] });
    const r = reader();
    await drain(db, storage, r);
    await draftPendingRubrics({ db, storage, reader: r });
    await approve(db, id);
    await gradePending({ db, storage, reader: r }, 10);
    expect(r.calls.grade[0]).toEqual({ qs: [1], images: 1 });
    // the photo is deleted (retention), then the rubric changes: text only, and said so
    await db.update(pages).set({ filePath: null }).where(eq(pages.kind, 'student'));
    const job = await jobRow(db, id);
    await db.update(jobs).set({ rubric: amendRubric(job.rubric, 1, { text: 'kabul', example: null, by: 'teacher' }), rubricRev: 2 }).where(eq(jobs.id, id));
    await gradePending({ db, storage, reader: r }, 10);
    expect(r.calls.grade[1]).toEqual({ qs: [1], images: 0 });
    const [sheet] = await db.select().from(pages).where(eq(pages.kind, 'student'));
    expect(sheet.grade!.questions[0]).toMatchObject({ textOnly: true, confidence: 'low' });
  });

  it('cancels a rubric nobody approves within 7 days and gives every page back', async () => {
    const { db, storage, u, id } = await submitted({ key: 'key', students: ['front1', 'front2'], balance: 2 });
    const r = reader();
    await drain(db, storage, r);
    await draftPendingRubrics({ db, storage, reader: r });
    await db.update(jobs).set({ rubricReadyAt: new Date(Date.now() - 8 * 86_400_000) }).where(eq(jobs.id, id));
    expect(await expireRubrics(db)).toBe(1);
    expect(await jobRow(db, id)).toMatchObject({ status: 'failed', failReason: 'rubric_expired' });
    const mailer = fakeMailer();
    await deliverPending({ db, storage, mailer });
    expect(mailer.sent[0].subject).toBe('10-A Karma: sınav iptal edildi');
    expect((await db.select().from(users).where(eq(users.id, u.id)))[0].pageBalance).toBe(2);
    expect(storage.files.size).toBe(0);
  });

  it('never sends a klasik report without the teacher', async () => {
    const { db, id } = await submitted({ key: 'key', students: ['front1'] });
    await db.update(jobs).set({ status: 'review', finishedAt: new Date(Date.now() - 30 * 86_400_000) }).where(eq(jobs.id, id));
    expect(await autoDeliverStale(db)).toBe(0);
  });
});
