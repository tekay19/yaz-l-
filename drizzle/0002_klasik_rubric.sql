ALTER TYPE "public"."job_status" ADD VALUE 'rubric' BEFORE 'review';--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "key_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "rubric" jsonb;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "rubric_rev" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "rubric_approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "rubric_ready_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "rubric_draft_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "rubric_draft_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "rubric_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "review_reminded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "fail_reason" text;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "grade" jsonb;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "graded_rev" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "grade_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "grade_lease_until" timestamp with time zone;