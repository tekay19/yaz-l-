import { HttpError } from '@/lib/http';
import { and, asc, count, eq, inArray, lt } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '@/db/client';
import { jobs, pages } from '@/db/schema';
import type { KlasikLine, PageOverride, Rubric } from '@/lib/types';
import { normalizeName } from '@/lib/grading/names';
import { failReason } from '@/lib/report/common';
import { rubricOf, sheetStudent } from '@/lib/report/klasik';
import { answerText, mergeSheets, type Sheet, strayWriting } from './sheets';
import { FLAG_TEXT, INFO_FLAGS, attentionFlags, scoreSheet, type QuestionScore, type ScoreFlag } from './score';
import { RubricInput, amendRubric, fromInput, rubricProblems } from './rubric';
import { MAX_KEY_TEXT, MAX_TEACHER_NOTE } from '@/lib/limits';

// What the klasik screens can do to a job. Every function checks the job's
// state itself and throws KlasikError with a Turkish message the route
// passes on as is.

type Job = typeof jobs.$inferSelect;

export class KlasikError extends HttpError {}
const fail = (status: number, message: string): never => {
  throw new KlasikError(status, message);
};


export async function setKeyText(db: Db, job: Job, text: string) {
  if (!['draft', 'rubric'].includes(job.status)) fail(409, 'Bu aşamada anahtar değiştirilemez.');
  await db.update(jobs).set({ keyText: text.slice(0, MAX_KEY_TEXT) }).where(eq(jobs.id, job.id));
}

// the teacher's note to the reader and grader; fixed once the exam is sent,
// so every page is read under the same note
export async function setTeacherNote(db: Db, job: Job, note: string) {
  if (job.status !== 'draft') fail(409, 'Gönderilmiş sınavın notu değiştirilemez.');
  await db.update(jobs).set({ teacherNote: note.trim().slice(0, MAX_TEACHER_NOTE) }).where(eq(jobs.id, job.id));
}

export function rubricView(job: Job) {
  return {
    status: job.status,
    keyText: job.keyText,
    rubric: job.rubric,
    approved: Boolean(job.rubricApprovedAt),
    problems: job.rubric ? rubricProblems(job.rubric) : [],
  };
}

export async function saveRubric(db: Db, job: Job, body: unknown): Promise<Rubric> {
  if (job.status !== 'rubric') fail(409, 'Puanlama şu anda düzenlenemez.');
  const parsed = RubricInput.safeParse(body);
  if (!parsed.success) {
    const custom = parsed.error.issues.find((i) => i.code === 'custom');
    fail(400, custom?.message ?? 'Puanlama eksik ya da hatalı: her sorunun en az bir ölçütü olmalı; ölçüt metni boş, puanı sıfır olamaz.');
  }
  const rubric = fromInput(parsed.data!);
  await db.update(jobs).set({ rubric }).where(and(eq(jobs.id, job.id), eq(jobs.status, 'rubric')));
  return rubric;
}

export async function approveRubric(db: Db, job: Job) {
  if (job.status !== 'rubric') fail(409, 'Puanlama onay beklemiyor.');
  const problems = rubricProblems(job.rubric);
  if (problems.length) fail(400, problems.join(' '));
  const moved = await db.update(jobs).set({ rubricApprovedAt: new Date(), rubricRev: 1, status: 'processing' })
    .where(and(eq(jobs.id, job.id), eq(jobs.status, 'rubric')))
    .returning({ id: jobs.id });
  if (!moved.length) fail(409, 'Puanlama onay beklemiyor.');
}

// Draft the rubric again, e.g. after the teacher typed the key the photo
// could not give. The 7-day deadline keeps running.
export async function redraftRubric(db: Db, job: Job) {
  if (job.status !== 'rubric') fail(409, 'Puanlama şu anda yeniden hazırlanamaz.');
  await db.update(jobs).set({ rubric: null, rubricDraftAt: null, rubricDraftAttempts: 0, status: 'processing' })
    .where(and(eq(jobs.id, job.id), eq(jobs.status, 'rubric')));
}

// pages are grouped into sheets by the names on them, matched to the roster
type JobRef = { id: string; roster: string[] };

async function sheetsOf(db: Db, job: JobRef) {
  const rows = await db.select().from(pages).where(and(eq(pages.jobId, job.id), eq(pages.kind, 'student'))).orderBy(asc(pages.seq));
  return { rows, ...mergeSheets(rows, job.roster) };
}

async function findSheet(db: Db, job: JobRef, pageId: string): Promise<Sheet> {
  const { sheets } = await sheetsOf(db, job);
  return sheets.find((s) => s.pageId === pageId) ?? fail(404, 'Kâğıt bulunamadı.');
}

// "Accept this answer": the answer becomes an example of full credit for its
// question, and the question goes back for grading on every sheet the teacher
// has not scored by hand — so other students who took the same valid path
// are corrected too.
export async function acceptAnswer(db: Db, job: Job, input: { pageId: string; q: number; note: string }) {
  if (job.status !== 'review') fail(409, 'Sınav kontrol aşamasında değil.');
  const sheet = await findSheet(db, job, input.pageId);
  const example = answerText(sheet.read.answers.find((a) => a.q === input.q)).trim();
  if (!example) fail(400, 'Bu soruda kabul edilecek bir cevap yok.');
  await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(jobs).where(eq(jobs.id, job.id)).for('update');
    if (locked.status !== 'review' || !locked.rubric) fail(409, 'Sınav kontrol aşamasında değil.');
    if (!locked.rubric!.questions.some((x) => x.q === input.q)) fail(400, 'Sınavda böyle bir soru yok.');
    const text = input.note.trim() || `Kâğıt ${sheet.seqs[0]}'deki cevap tam doğru kabul edildi.`;
    const rubric = amendRubric(locked.rubric!, input.q, { text: text.slice(0, 500), example: example.slice(0, 4000), by: 'teacher' });
    await tx.update(jobs).set({ rubric, rubricRev: locked.rubricRev + 1 }).where(eq(jobs.id, job.id));
  });
}

const Q = z.number().int().min(1).max(200);
export const KlasikPatch = z.object({
  studentName: z.string().trim().min(1).max(80).optional(),
  points: z.array(z.object({ q: Q, points: z.number().min(0).max(100).nullable() })).max(200).optional(),
  texts: z.array(z.object({ q: Q, text: z.string().max(4000) })).max(50).optional(),
});

// The teacher's own points (null removes them), a fixed transcription (that
// question is graded again) or the student's name.
export async function saveKlasikOverride(db: Db, job: Job, pageId: string, body: unknown) {
  if (job.status !== 'review') fail(409, 'Sınav kontrol aşamasında değil.');
  const parsed = KlasikPatch.safeParse(body);
  if (!parsed.success) fail(400, 'Düzeltme geçersiz.');
  const patch = parsed.data!;
  const rubric = rubricOf(job);
  const asked = [...(patch.points ?? []).map((p) => p.q), ...(patch.texts ?? []).map((t) => t.q)];
  if (asked.some((q) => !rubric.questions.some((x) => x.q === q))) fail(400, 'Sınavda böyle bir soru yok.');
  const sheet = await findSheet(db, job, pageId);

  const prev: PageOverride = sheet.override;
  const points = new Map((prev.points ?? []).map((p) => [p.q, p]));
  const regrade = new Set<number>();
  for (const p of patch.points ?? []) {
    if (p.points === null) {
      points.delete(p.q);
      regrade.add(p.q); // back to the model's verdict, which may never have been made
    } else points.set(p.q, { q: p.q, points: p.points });
  }
  const texts = new Map((prev.texts ?? []).map((t) => [t.q, t]));
  for (const t of patch.texts ?? []) {
    texts.set(t.q, t);
    regrade.add(t.q);
  }
  const textChanged = new Set((patch.texts ?? []).map((t) => t.q));
  const grade = sheet.grade && textChanged.size
    ? { questions: sheet.grade.questions.filter((g) => !textChanged.has(g.q)) }
    : sheet.grade;
  await db.update(pages).set({
    override: { ...prev, studentName: patch.studentName ?? prev.studentName, points: [...points.values()], texts: [...texts.values()] },
    grade,
    ...(regrade.size ? { gradedRev: 0, gradeAttempts: 0, gradeLeaseUntil: null } : {}),
  }).where(eq(pages.id, sheet.pageId));
}

// After grading gave up on a sheet: try again.
export async function requestRegrade(db: Db, job: Job, pageId: string) {
  if (job.status !== 'review') fail(409, 'Sınav kontrol aşamasında değil.');
  const sheet = await findSheet(db, job, pageId);
  await db.update(pages).set({ gradedRev: 0, gradeAttempts: 0, gradeLeaseUntil: null }).where(eq(pages.id, sheet.pageId));
}

// The teacher changed the class list during review: the sheets regroup by
// the names. A sheet whose pages changed is graded again (the questions from
// its new pages have no verdict on it yet); the review waits until it is.
export async function regradeRegrouped(db: Db, jobId: string, before: string[], after: string[]): Promise<number> {
  const rows = await db.select().from(pages).where(and(eq(pages.jobId, jobId), eq(pages.kind, 'student')));
  const old = new Set(mergeSheets(rows, before).sheets.map((s) => s.pageIds.join(',')));
  const changed = mergeSheets(rows, after).sheets.filter((s) => !old.has(s.pageIds.join(',')));
  const ids = changed.flatMap((s) => s.pageIds);
  if (ids.length) await db.update(pages).set({ gradedRev: 0, gradeAttempts: 0, gradeLeaseUntil: null }).where(inArray(pages.id, ids));
  return changed.length;
}

export async function regradesPending(db: Db, job: Pick<Job, 'id' | 'rubricRev'>): Promise<number> {
  const [{ n }] = await db.select({ n: count() }).from(pages).where(and(
    eq(pages.jobId, job.id), eq(pages.kind, 'student'), eq(pages.status, 'read'), lt(pages.gradedRev, job.rubricRev),
  ));
  return n;
}

// ── The review screen ───────────────────────────────────────────────────────

export type ReviewNote = { code: ScoreFlag; text: string; attention: boolean };
export type ReviewQuestion = Omit<QuestionScore, 'flags'> & {
  lines: KlasikLine[]; unclear: boolean; hasFigure: boolean; altText: string | null; note: string; firstError: string | null; notes: ReviewNote[];
};
export type ReviewSheet = {
  pageId: string; seqs: number[]; student: string; nameFlags: string[];
  total: number; max: number; percent: number; pending: number; attention: number;
  imageUrls: string[]; questions: ReviewQuestion[];
};
export type KlasikReview = {
  mode: 'klasik'; roster: string[]; rubric: Rubric; sheets: ReviewSheet[];
  failed: { seq: number; reason: string }[]; pending: number;
};

export async function klasikReviewView(db: Db, job: Job): Promise<KlasikReview> {
  const rubric = rubricOf(job);
  const { rows, sheets, failed } = await sheetsOf(db, job);
  const hasPhoto = new Set(rows.filter((p) => p.filePath).map((p) => p.id));
  const view: ReviewSheet[] = sheets.map((s) => {
    const sc = scoreSheet(rubric, s);
    const who = sheetStudent(s, job.roster);
    const questions: ReviewQuestion[] = sc.questions.map(({ flags, ...q }) => {
      const a = s.read.answers.find((x) => x.q === q.q);
      const attention = new Set(attentionFlags({ ...q, flags }));
      return {
        ...q, lines: a?.lines ?? [], unclear: a?.unclear ?? false, hasFigure: a?.hasFigure ?? false, altText: a?.altText ?? null,
        note: q.grade?.note ?? '', firstError: q.grade?.firstError ?? null,
        notes: flags.filter((f) => f !== 'pending').map((f) => ({ code: f, text: FLAG_TEXT[f], attention: attention.has(f) && !INFO_FLAGS.has(f) })),
      };
    });
    return {
      pageId: s.pageId, seqs: s.seqs, student: who.student ?? `Kâğıt ${s.seqs[0]}`,
      nameFlags: [...who.flags, ...strayWriting(s.read, rubric.questions.map((q) => q.q))],
      total: sc.total, max: sc.max, percent: sc.percent, pending: sc.pending,
      attention: questions.filter((q) => q.notes.some((n) => n.attention)).length,
      imageUrls: s.pageIds.filter((id) => hasPhoto.has(id)).map((id) => `/api/jobs/${job.id}/pages/${id}`),
      questions,
    };
  });
  // two sheets under one name hide one student's result behind another's
  const byName = new Map<string, ReviewSheet[]>();
  for (const s of view) {
    const k = normalizeName(s.student);
    if (k && s.student !== `Kâğıt ${s.seqs[0]}`) byName.set(k, [...(byName.get(k) ?? []), s]);
  }
  for (const group of byName.values()) if (group.length > 1) for (const s of group) s.nameFlags.unshift('İsim başka bir kâğıtta da var');
  return {
    mode: 'klasik', roster: job.roster, rubric, sheets: view,
    failed: failed.map((p) => ({ seq: p.seq, reason: failReason(p.error) })),
    pending: await regradesPending(db, job),
  };
}
