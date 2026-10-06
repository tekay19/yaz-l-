import {
  pgTable, pgEnum, uuid, text, integer, timestamp, jsonb, doublePrecision,
  uniqueIndex, index,
} from 'drizzle-orm/pg-core';
import type { GradingStyle, KlasikGrade, PageOverride, PageResult, Rubric } from '@/lib/types';

// a teacher's defaults for new exams, set on the settings screen
export type UserSettings = { style?: GradingStyle; note?: string };

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const examMode = pgEnum('exam_mode', ['optik', 'klasik']);
export const jobStatus = pgEnum('job_status', [
  'draft', 'queued', 'processing', 'rubric', 'review', 'delivering', 'done', 'failed',
]);
export const pageKind = pgEnum('page_kind', ['key', 'student']);
export const pageStatus = pgEnum('page_status', ['uploaded', 'queued', 'reading', 'read', 'failed']);

export type UserRole = 'teacher' | 'admin';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull().default(''),
  // scrypt; null for an account opened before passwords, which sets one
  // through "şifremi unuttum"
  passwordHash: text('password_hash'),
  role: text('role').$type<UserRole>().notNull().default('teacher'),
  emailVerifiedAt: ts('email_verified_at'),
  suspendedAt: ts('suspended_at'),
  // part of every session cookie: bumping it signs the user out everywhere
  sessionVersion: integer('session_version').notNull().default(0),
  lastLoginAt: ts('last_login_at'),
  pageBalance: integer('page_balance').notNull().default(0),
  settings: jsonb('settings').$type<UserSettings>().notNull().default({}),
  createdAt: ts('created_at').notNull().defaultNow(),
});

// A teacher's saved class lists (9-A, 9-B), picked in the upload wizard
// instead of pasting the roster for every exam.
export const classes = pgTable('classes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  students: jsonb('students').$type<string[]>().notNull().default([]),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('classes_user_name').on(t.userId, t.name)]);

// One-time links sent by e-mail: confirming the address, resetting the
// password. Only the sha256 of the token is stored.
export const authTokens = pgTable('auth_tokens', {
  tokenHash: text('token_hash').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  purpose: text('purpose').$type<'verify' | 'reset'>().notNull(),
  expiresAt: ts('expires_at').notNull(),
  usedAt: ts('used_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [index('auth_tokens_user').on(t.userId, t.purpose)]);

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default(''),
  mode: examMode('mode').notNull().default('optik'),
  status: jobStatus('status').notNull().default('draft'),
  roster: jsonb('roster').$type<string[]>().notNull().default([]),
  klasikMax: jsonb('klasik_max').$type<number[]>().notNull().default([]),
  reservedPages: integer('reserved_pages').notNull().default(0),
  consentAt: ts('consent_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
  submittedAt: ts('submitted_at'),
  finishedAt: ts('finished_at'),
  deliveryAttemptAt: ts('delivery_attempt_at'),
  notifiedAt: ts('notified_at'),
  // a job waiting in review: when the teacher was told, and whether the report
  // later went out on its own because nobody approved it
  reviewNotifiedAt: ts('review_notified_at'),
  autoDeliveredAt: ts('auto_delivered_at'),
  // klasik: the typed answer key, the rubric the teacher approves, and the
  // bookkeeping of drafting it, waiting for it and grading against it
  keyText: text('key_text').notNull().default(''),
  // the teacher's optional note to the reader and grader ("cevaplar arkada devam ediyor")
  teacherNote: text('teacher_note').notNull().default(''),
  rubric: jsonb('rubric').$type<Rubric>(),
  rubricRev: integer('rubric_rev').notNull().default(0),
  rubricApprovedAt: ts('rubric_approved_at'),
  rubricReadyAt: ts('rubric_ready_at'),
  rubricDraftAt: ts('rubric_draft_at'),
  rubricDraftAttempts: integer('rubric_draft_attempts').notNull().default(0),
  rubricNotifiedAt: ts('rubric_notified_at'),
  reviewRemindedAt: ts('review_reminded_at'),
  failReason: text('fail_reason').$type<'key_failed' | 'rubric_expired' | 'review_expired' | 'admin_closed'>(),
}, (t) => [index('jobs_user').on(t.userId), index('jobs_status').on(t.status)]);

export const pages = pgTable('pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  kind: pageKind('kind').notNull(),
  seq: integer('seq').notNull(),
  filePath: text('file_path'), // null once the photo is deleted
  status: pageStatus('status').notNull().default('uploaded'),
  attempts: integer('attempts').notNull().default(0),
  leaseUntil: ts('lease_until'),
  result: jsonb('result').$type<PageResult>(),
  override: jsonb('override').$type<PageOverride>(),
  error: text('error'),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  // klasik: the verdicts for the sheet that starts on this page, the job's
  // rubric revision they were made against, and the grading queue's lease
  grade: jsonb('grade').$type<KlasikGrade>(),
  gradedRev: integer('graded_rev').notNull().default(0),
  gradeAttempts: integer('grade_attempts').notNull().default(0),
  gradeLeaseUntil: ts('grade_lease_until'),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('pages_job_kind_seq').on(t.jobId, t.kind, t.seq),
  index('pages_status').on(t.status, t.leaseUntil),
]);

export const ledger = pgTable('ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  delta: integer('delta').notNull(),
  reason: text('reason').$type<'purchase' | 'job_reserve' | 'job_refund' | 'admin_grant' | 'admin_debit'>().notNull(),
  ref: text('ref').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('ledger_reason_ref').on(t.reason, t.ref)]);

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  // kept after account deletion: accounting records must outlive the user
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  pack: text('pack').notNull(),
  pages: integer('pages').notNull(),
  amountKurus: integer('amount_kurus').notNull(),
  providerToken: text('provider_token').unique(),
  status: text('status').$type<'pending' | 'paid' | 'failed'>().notNull().default('pending'),
  createdAt: ts('created_at').notNull().defaultNow(),
  paidAt: ts('paid_at'),
});

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  ts: ts('ts').notNull(),
  event: text('event').notNull(),
  page: text('page').notNull().default(''),
  label: text('label').notNull().default(''),
  value: doublePrecision('value'),
  visitor: text('visitor').notNull().default(''),
  session: text('session').notNull().default(''),
  ref: text('ref').notNull().default(''),
  utm: text('utm').notNull().default(''),
  vw: doublePrecision('vw'),
  ua: text('ua').notNull().default(''),
}, (t) => [index('events_ts').on(t.ts)]);

// What an admin did from the panel, kept after the admin's account is gone.
export const adminActions = pgTable('admin_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  adminId: uuid('admin_id').references(() => users.id, { onDelete: 'set null' }),
  adminEmail: text('admin_email').notNull(),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  detail: jsonb('detail').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [index('admin_actions_created').on(t.createdAt)]);
