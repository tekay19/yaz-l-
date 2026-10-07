import { and, asc, count, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '@/db/client';
import { classes, jobs, ledger, payments, users, type UserSettings } from '@/db/schema';
import { GRADING_STYLES, type GradingStyle } from '@/lib/types';
import { MAX_TEACHER_NOTE } from '@/lib/limits';
import { HttpError } from '@/lib/http';
import { isUuid } from '@/lib/uuid';

// What a teacher keeps between exams: saved class lists, defaults for new
// exams, and the history of their page balance.

export const MAX_CLASSES = 60;
export const MAX_CLASS_STUDENTS = 200;

// one name per line, as pasted from e-Okul or a spreadsheet; duplicates dropped
export const parseNames = (text: string) =>
  [...new Set(text.split(/\r?\n/).map((l) => l.replace(/\t.*$/, '').trim().slice(0, 80)).filter(Boolean))].slice(0, MAX_CLASS_STUDENTS);

export type ClassView = { id: string; name: string; students: string[]; updatedAt: string };

const view = (c: typeof classes.$inferSelect): ClassView =>
  ({ id: c.id, name: c.name, students: c.students, updatedAt: c.updatedAt.toISOString() });

export async function listClasses(db: Db, userId: string): Promise<ClassView[]> {
  const rows = await db.select().from(classes).where(eq(classes.userId, userId)).orderBy(asc(classes.name));
  return rows.map(view);
}

function cleanName(name: unknown): string {
  const n = typeof name === 'string' ? name.trim().slice(0, 60) : '';
  if (!n) throw new HttpError(400, 'Sınıfa bir ad verin (ör. 9-A).');
  return n;
}

// a second class with the same name is refused rather than overwritten
async function nameTaken(db: Db, userId: string, name: string, except?: string) {
  const [row] = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.userId, userId), eq(classes.name, name)));
  return Boolean(row && row.id !== except);
}

export async function createClass(db: Db, userId: string, input: { name?: unknown; students?: unknown }): Promise<ClassView> {
  const name = cleanName(input.name);
  const students = parseNames(typeof input.students === 'string' ? input.students : '');
  const [{ n }] = await db.select({ n: count() }).from(classes).where(eq(classes.userId, userId));
  if (n >= MAX_CLASSES) throw new HttpError(400, `En fazla ${MAX_CLASSES} sınıf kaydedilebilir.`);
  if (await nameTaken(db, userId, name)) throw new HttpError(409, `"${name}" adında bir sınıfınız zaten var.`);
  const [row] = await db.insert(classes).values({ userId, name, students }).returning();
  return view(row);
}

export async function updateClass(db: Db, userId: string, id: string, input: { name?: unknown; students?: unknown }): Promise<ClassView> {
  if (!isUuid(id)) throw new HttpError(404, 'Sınıf bulunamadı.');
  const set: Partial<typeof classes.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) {
    set.name = cleanName(input.name);
    if (await nameTaken(db, userId, set.name, id)) throw new HttpError(409, `"${set.name}" adında bir sınıfınız zaten var.`);
  }
  if (typeof input.students === 'string') set.students = parseNames(input.students);
  const [row] = await db.update(classes).set(set).where(and(eq(classes.id, id), eq(classes.userId, userId))).returning();
  if (!row) throw new HttpError(404, 'Sınıf bulunamadı.');
  return view(row);
}

export async function deleteClass(db: Db, userId: string, id: string) {
  if (!isUuid(id)) throw new HttpError(404, 'Sınıf bulunamadı.');
  const rows = await db.delete(classes).where(and(eq(classes.id, id), eq(classes.userId, userId))).returning({ id: classes.id });
  if (!rows.length) throw new HttpError(404, 'Sınıf bulunamadı.');
}

export async function getSettings(db: Db, userId: string): Promise<UserSettings> {
  const [u] = await db.select({ settings: users.settings }).from(users).where(eq(users.id, userId));
  return u?.settings ?? {};
}

export async function saveSettings(db: Db, userId: string, input: { style?: unknown; note?: unknown }): Promise<UserSettings> {
  const next: UserSettings = {};
  if (typeof input.style === 'string') {
    if (!GRADING_STYLES.includes(input.style as GradingStyle)) throw new HttpError(400, 'Puanlama tarzı geçersiz.');
    next.style = input.style as GradingStyle;
  }
  if (typeof input.note === 'string' && input.note.trim()) next.note = input.note.trim().slice(0, MAX_TEACHER_NOTE);
  await db.update(users).set({ settings: next }).where(eq(users.id, userId));
  return next;
}

export type HistoryEntry = {
  at: string; delta: number;
  kind: 'purchase' | 'job_reserve' | 'job_refund' | 'admin_grant' | 'admin_debit';
  label: string; amountKurus: number | null;
};

// The page balance, line by line: packs bought (with what was paid), pages
// an exam used and pages given back. Newest first.
export async function balanceHistory(db: Db, userId: string, limit = 100): Promise<HistoryEntry[]> {
  const rows = await db.select().from(ledger).where(eq(ledger.userId, userId)).orderBy(desc(ledger.createdAt)).limit(limit);
  const jobIds = [...new Set(rows.filter((r) => r.reason !== 'purchase' && r.reason !== 'admin_grant' && r.reason !== 'admin_debit').map((r) => r.ref.split(':')[0]))];
  const payIds = rows.filter((r) => r.reason === 'purchase').map((r) => r.ref);
  const titles = new Map((jobIds.length
    ? await db.select({ id: jobs.id, title: jobs.title }).from(jobs).where(inArray(jobs.id, jobIds.filter(isUuid)))
    : []).map((j) => [j.id, j.title || 'Adsız sınav']));
  const paid = new Map((payIds.length
    ? await db.select({ id: payments.id, pack: payments.pack, amount: payments.amountKurus }).from(payments).where(inArray(payments.id, payIds.filter(isUuid)))
    : []).map((p) => [p.id, p]));
  return rows.map((r) => {
    const job = titles.get(r.ref.split(':')[0]) ?? 'Silinmiş sınav';
    const pay = paid.get(r.ref);
    const label = r.reason === 'purchase' ? `${pay?.pack ?? 'Paket'} paketi`
      : r.reason === 'admin_grant' ? 'Tanımlanan sayfa hakkı'
        : r.reason === 'admin_debit' ? 'Düşülen sayfa hakkı'
        : r.reason === 'job_reserve' ? job : `${job} — iade`;
    return { at: r.createdAt.toISOString(), delta: r.delta, kind: r.reason, label, amountKurus: pay?.amount ?? null };
  });
}

