import {
  pgTable, pgEnum, uuid, text, integer, timestamp, jsonb, doublePrecision,
  uniqueIndex, index,
} from 'drizzle-orm/pg-core';
import type { PageOverride, PageResult } from '@/lib/types';

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const examMode = pgEnum('exam_mode', ['optik', 'klasik']);
export const jobStatus = pgEnum('job_status', [
  'draft', 'queued', 'processing', 'review', 'delivering', 'done', 'failed',
]);
export const pageKind = pgEnum('page_kind', ['key', 'student']);
export const pageStatus = pgEnum('page_status', ['uploaded', 'queued', 'reading', 'read', 'failed']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  pageBalance: integer('page_balance').notNull().default(0),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const loginTokens = pgTable('login_tokens', {
  tokenHash: text('token_hash').primaryKey(),
  email: text('email').notNull(),
  expiresAt: ts('expires_at').notNull(),
  usedAt: ts('used_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
});

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
  createdAt: ts('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('pages_job_kind_seq').on(t.jobId, t.kind, t.seq),
  index('pages_status').on(t.status, t.leaseUntil),
]);

export const ledger = pgTable('ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  delta: integer('delta').notNull(),
  reason: text('reason').$type<'purchase' | 'job_reserve' | 'job_refund' | 'admin_grant'>().notNull(),
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
