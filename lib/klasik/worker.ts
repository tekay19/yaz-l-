import { and, asc, count, eq, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { jobs, pages, users } from '@/db/schema';
import type { Storage } from '@/lib/storage';
import type { Reader, Usage } from '@/lib/reader/types';
import { refundPages } from '@/lib/credits';
import { LEASE_MS, retryBackoffMs } from '@/lib/queue';
import type { PageResult, QuestionGrade, Rubric } from '@/lib/types';
import { answerText, mergeSheets, nameFixes, type Sheet, type SheetPage } from './sheets';
import { failedGrade, toGrade } from './grade';
import { gradeInChunks } from './chunks';
import { emptyRubric, normalizeDraft, rubricProblems } from './rubric';

// The klasik steps of the worker loop, each a job-level pass like delivery:
//   draftPendingRubrics  key read (or typed) → rubric draft → grading starts at once;
//                        only a draft that cannot grade waits in 'rubric'
//   gradePending         rubric approved + pages read → verdicts per sheet
//   completeKlasikJobs   everything graded → 'review', unread pages refunded
//   expireRubrics        key never given → job cancelled, full refund

export const RUBRIC_MAX_ATTEMPTS = 3;
// longer than one draft call may take (the reader timeout), so a slow draft
// is never claimed and paid for a second time by another worker
export const RUBRIC_RETRY_MS = LEASE_MS;
export const GRADE_MAX_ATTEMPTS = 3;
export const RUBRIC_EXPIRE_DAYS = 7;

type Deps = { db: Db; storage: Storage; reader: Reader };
// Proof that an attempt still holds a sheet. The attempt counter alone is not
// enough: a teacher's edit resets it to 0, so a second claim would count up to
// the same number and a slow first attempt could write a grade of the old
// text. The lease end written at claim time differs between claims.
type Hold = { attempts: number; lease: Date };
const holding = (pageId: string, hold: Hold) =>
  and(eq(pages.id, pageId), eq(pages.gradeAttempts, hold.attempts), eq(pages.gradeLeaseUntil, hold.lease));
type Job = typeof jobs.$inferSelect;

// The key as text for the rubric draft: what the teacher typed, then what the
// key photos say, question by question.
export function keyTextOf(job: Pick<Job, 'keyText'>, keyPages: { result: PageResult | null }[]): string {
  const fromPhotos = keyPages
    .flatMap((p) => (p.result?.type === 'klasik-key' ? p.result.read.answers : []))
    .map((a) => ({ q: a.q, text: answerText(a).trim() }))
    .filter((a) => a.text)
    .map((a) => `${a.q}. soru:\n${a.text}`);
  return [job.keyText.trim(), ...fromPhotos].filter(Boolean).join('\n\n');
}

// The points printed on the key next to each question ("(15 puan)"), from the
// "Soru:" line the key reading keeps; [] when the key shows none.
export function keyPointsOf(keyPages: { result: PageResult | null }[]): number[] {
  const out: number[] = [];
  for (const a of keyPages.flatMap((p) => (p.result?.type === 'klasik-key' ? p.result.read.answers : []))) {
    if (a.q < 1 || a.q > 200) continue;
    const line = a.lines.find((l) => /^\s*soru\s*:/i.test(l.text));
    const m = line?.text.match(/\(\s*(\d+(?:[.,]5)?)\s*puan\s*\)/i);
    if (m) out[a.q - 1] = Number(m[1].replace(',', '.'));
  }
  return out.some((p) => p > 0) ? Array.from(out, (p) => p ?? 0) : [];
}

const keyPagesSettled = sql`not exists (select 1 from pages k where k.job_id = ${jobs.id} and k.kind = 'key' and k.status in ('queued', 'reading'))`;

export async function draftPendingRubrics({ db, reader }: Deps, now = new Date()): Promise<number> {
  const retryBefore = new Date(now.getTime() - RUBRIC_RETRY_MS);
  const free = or(isNull(jobs.rubricDraftAt), lt(jobs.rubricDraftAt, retryBefore));
  const due = await db.select({ id: jobs.id }).from(jobs).where(and(
    eq(jobs.mode, 'klasik'), inArray(jobs.status, ['queued', 'processing']), isNull(jobs.rubric),
    lt(jobs.rubricDraftAttempts, RUBRIC_MAX_ATTEMPTS), free, keyPagesSettled,
  )).limit(3);

  let drafted = 0;
  for (const { id } of due) {
    // claim: a worker that got here first has already moved the stamp
    const [job] = await db.update(jobs)
      .set({ rubricDraftAt: now, rubricDraftAttempts: sql`${jobs.rubricDraftAttempts} + 1` })
      .where(and(eq(jobs.id, id), isNull(jobs.rubric), free))
      .returning();
    if (!job) continue;
    const keyPages = await db.select({ result: pages.result }).from(pages)
      .where(and(eq(pages.jobId, id), eq(pages.kind, 'key'), eq(pages.status, 'read')))
      .orderBy(asc(pages.seq));
    const keyText = keyTextOf(job, keyPages);
    // the teacher's points, else the ones printed on the key, else 10 each
    const maxPoints = job.klasikMax.length ? job.klasikMax : keyPointsOf(keyPages);
    let rubric: Rubric | null = null;
    if (!keyText) {
      rubric = emptyRubric(); // nothing readable: the teacher types the key or builds the rubric
    } else {
      try {
        const { read } = await reader.draftRubric({ keyText, maxPoints, note: job.teacherNote });
        // the teacher's default grading style starts every question
        const [owner] = await db.select({ settings: users.settings }).from(users).where(eq(users.id, job.userId));
        rubric = normalizeDraft(read, maxPoints, owner?.settings.style);
      } catch (e) {
        console.error('[klasik] rubric_draft_failed', id, e instanceof Error ? e.message : e);
        if (job.rubricDraftAttempts >= RUBRIC_MAX_ATTEMPTS) rubric = emptyRubric();
      }
    }
    if (rubric && await enterRubric(db, id, rubric, now)) drafted++;
  }
  return drafted;
}

async function enterRubric(db: Db, jobId: string, rubric: Rubric, now: Date) {
  // A draft that can grade is approved at once: the teacher checks the
  // points afterwards, not the criteria before. Only one that cannot (the key
  // was unreadable, a question has no criteria) waits in 'rubric' for the
  // teacher to give the key. The 7-day clock starts once and is not reset by
  // a redraft.
  const readyAt = sql`coalesce(${jobs.rubricReadyAt}, ${now.toISOString()}::timestamptz)`;
  const moved = await db.update(jobs)
    .set(rubricProblems(rubric).length
      ? { rubric, status: 'rubric', rubricReadyAt: readyAt }
      : { rubric, status: 'processing', rubricReadyAt: readyAt, rubricApprovedAt: now, rubricRev: 1 })
    .where(and(eq(jobs.id, jobId), inArray(jobs.status, ['queued', 'processing']), isNull(jobs.rubric)))
    .returning({ id: jobs.id });
  return moved.length > 0;
}

async function loadPhotos(storage: Storage, keys: string[]): Promise<Buffer[]> {
  const out: Buffer[] = [];
  for (const k of keys) {
    try {
      out.push(await storage.read(k));
    } catch {
      // deleted by retention: the figure is judged from the transcription alone
    }
  }
  return out;
}

// Once, before the first grade of a job without a roster: a student's name
// misread on one page is mended, so their pages make one sheet. Later the
// grouping must not change under grades already written.
async function mendNames<T extends SheetPage>(db: Db, rows: T[]): Promise<T[]> {
  const fixes = nameFixes(rows);
  if (!fixes.size) return rows;
  return Promise.all(rows.map(async (p) => {
    const name = fixes.get(p.id);
    if (!name || p.result?.type !== 'klasik-student') return p;
    const result = { ...p.result, read: { ...p.result.read, studentName: name } };
    await db.update(pages).set({ result }).where(eq(pages.id, p.id));
    return { ...p, result };
  }));
}

export async function gradePending(deps: Deps, limit: number, now = new Date()): Promise<number> {
  const { db } = deps;
  const due = await db.select().from(jobs).where(and(
    eq(jobs.mode, 'klasik'), isNotNull(jobs.rubricApprovedAt), inArray(jobs.status, ['processing', 'review']),
    sql`not exists (select 1 from pages p where p.job_id = ${jobs.id} and p.kind = 'student' and p.status in ('queued', 'reading'))`,
    sql`exists (select 1 from pages p where p.job_id = ${jobs.id} and p.kind = 'student' and p.status = 'read'
      and p.graded_rev < ${jobs.rubricRev}
      and (p.grade_lease_until is null or p.grade_lease_until < ${now.toISOString()}::timestamptz))`,
  )).limit(limit);

  const work: Promise<void>[] = [];
  for (const job of due) {
    let rows = await db.select().from(pages).where(and(eq(pages.jobId, job.id), eq(pages.kind, 'student')));
    if (!job.roster.length && rows.every((p) => p.gradedRev === 0)) rows = await mendNames(db, rows);
    for (const sheet of mergeSheets(rows, job.roster).sheets) {
      if (work.length >= limit) break;
      if (sheet.gradedRev >= job.rubricRev) {
        await syncBackPages(db, sheet, job.rubricRev); // heals a sheet whose back pages lagged
        continue;
      }
      const leaseFree = or(isNull(pages.gradeLeaseUntil), lt(pages.gradeLeaseUntil, now));
      if (sheet.gradeAttempts >= GRADE_MAX_ATTEMPTS) {
        // the last attempt died with its worker: give up on what is left
        const lease = new Date(now.getTime() + LEASE_MS);
        const [held] = await db.update(pages).set({ gradeLeaseUntil: lease })
          .where(and(eq(pages.id, sheet.pageId), lt(pages.gradedRev, job.rubricRev), leaseFree))
          .returning({ attempts: pages.gradeAttempts });
        if (held) await settle(db, job, sheet, { attempts: held.attempts, lease }, pendingQuestions(job, sheet).map(failedGrade));
        continue;
      }
      const lease = new Date(now.getTime() + LEASE_MS);
      const [claimed] = await db.update(pages)
        .set({ gradeLeaseUntil: lease, gradeAttempts: sql`${pages.gradeAttempts} + 1` })
        .where(and(eq(pages.id, sheet.pageId), lt(pages.gradedRev, job.rubricRev), lt(pages.gradeAttempts, GRADE_MAX_ATTEMPTS), leaseFree))
        .returning({ attempts: pages.gradeAttempts });
      if (claimed) work.push(gradeSheet(deps, job, sheet, { attempts: claimed.attempts, lease }, now));
    }
  }
  await Promise.all(work);
  return work.length;
}

// Questions of this sheet that need a verdict against the current rubric:
// answered, not scored by the teacher, and never graded, graded against an
// older revision, or failed before.
export function pendingQuestions(job: Pick<Job, 'rubric'>, sheet: Sheet) {
  const rubric = job.rubric ?? emptyRubric();
  const settledByTeacher = new Set((sheet.override.points ?? []).map((p) => p.q));
  const current = sheet.grade?.questions ?? [];
  return rubric.questions.filter((rq) => {
    if (settledByTeacher.has(rq.q)) return false;
    if (!answerText(sheet.read.answers.find((a) => a.q === rq.q)).trim()) return false;
    const g = current.find((x) => x.q === rq.q);
    return !g || g.rev !== rq.rev || g.failed;
  });
}

async function gradeSheet({ db, storage, reader }: Deps, job: Job, sheet: Sheet, hold: Hold, now: Date) {
  const todo = pendingQuestions(job, sheet);
  try {
    let fresh: QuestionGrade[] = [];
    let usage: Usage | undefined;
    if (todo.length) {
      const answers = todo.map((rq) => sheet.read.answers.find((a) => a.q === rq.q)!);
      const images = answers.some((a) => a.hasFigure) ? await loadPhotos(storage, sheet.filePaths) : [];
      const out = await gradeInChunks(reader, { questions: todo, answers, images, note: job.teacherNote });
      fresh = todo.map((rq, i) => {
        const o = out.read.questions.find((x) => x.q === rq.q);
        if (!o) throw new Error(`grade_missing_q${rq.q}`); // retried: a partial answer is not a grade
        return toGrade(rq, o, answers[i].hasFigure && !images.length);
      });
      usage = out.usage;
    }
    await settle(db, job, sheet, hold, fresh, usage);
  } catch (e) {
    console.error('[klasik] grade_failed', sheet.pageId, e instanceof Error ? e.message : e);
    if (hold.attempts >= GRADE_MAX_ATTEMPTS) {
      await settle(db, job, sheet, hold, todo.map(failedGrade));
    } else {
      await db.update(pages).set({ gradeLeaseUntil: new Date(now.getTime() + retryBackoffMs(hold.attempts)) })
        .where(holding(sheet.pageId, hold));
    }
  }
}

// Store the new verdicts next to the still-valid ones. Only the attempt that
// holds the sheet may write (a slower worker whose lease ran out is ignored),
// and the sheet is stamped with the rubric revision it was read against: if
// the rubric changed meanwhile, the next pass re-grades just what changed.
async function settle(db: Db, job: Job, sheet: Sheet, hold: Hold, grades: QuestionGrade[], usage?: Usage) {
  const kept = (sheet.grade?.questions ?? []).filter((x) => !grades.some((n) => n.q === x.q));
  const [landed] = await db.update(pages).set({
    grade: { questions: [...kept, ...grades].sort((a, b) => a.q - b.q) },
    gradedRev: job.rubricRev,
    gradeAttempts: 0,
    gradeLeaseUntil: null,
    ...(usage ? {
      inputTokens: sql`${pages.inputTokens} + ${usage.inputTokens}`,
      outputTokens: sql`${pages.outputTokens} + ${usage.outputTokens}`,
    } : {}),
  }).where(holding(sheet.pageId, hold)).returning({ id: pages.id });
  if (landed) await syncBackPages(db, sheet, job.rubricRev);
}

async function syncBackPages(db: Db, sheet: Sheet, rev: number) {
  const back = sheet.pageIds.slice(1);
  if (back.length) {
    await db.update(pages).set({ gradedRev: rev }).where(and(inArray(pages.id, back), lt(pages.gradedRev, rev)));
  }
}

export async function completeKlasikJobs(db: Db, now = new Date()): Promise<number> {
  const ready = await db.select({ id: jobs.id, userId: jobs.userId }).from(jobs).where(and(
    eq(jobs.mode, 'klasik'), eq(jobs.status, 'processing'), isNotNull(jobs.rubricApprovedAt),
    sql`not exists (select 1 from pages p where p.job_id = ${jobs.id} and p.kind = 'student'
      and (p.status in ('queued', 'reading') or (p.status = 'read' and p.graded_rev < ${jobs.rubricRev})))`,
  ));
  let moved = 0;
  for (const job of ready) {
    const [row] = await db.update(jobs).set({ status: 'review', finishedAt: now })
      .where(and(eq(jobs.id, job.id), eq(jobs.status, 'processing')))
      .returning({ id: jobs.id });
    if (!row) continue;
    moved++;
    // unread pages come back as soon as grading ends, as for optik review
    const [{ n }] = await db.select({ n: count() }).from(pages)
      .where(and(eq(pages.jobId, job.id), eq(pages.kind, 'student'), eq(pages.status, 'failed')));
    await refundPages(db, job.userId, n, job.id);
  }
  return moved;
}

export async function expireRubrics(db: Db, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - RUBRIC_EXPIRE_DAYS * 86_400_000);
  const expired = await db.update(jobs).set({ status: 'failed', failReason: 'rubric_expired', finishedAt: now })
    .where(and(eq(jobs.status, 'rubric'), lt(jobs.rubricReadyAt, cutoff)))
    .returning({ id: jobs.id });
  if (expired.length) {
    // nothing is left to read for a cancelled job
    await db.update(pages).set({ status: 'failed', error: 'job_cancelled', leaseUntil: null })
      .where(and(inArray(pages.jobId, expired.map((j) => j.id)), inArray(pages.status, ['queued', 'reading'])));
  }
  return expired.length;
}
