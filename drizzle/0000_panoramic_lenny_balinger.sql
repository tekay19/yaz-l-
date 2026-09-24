CREATE TYPE "public"."exam_mode" AS ENUM('optik', 'klasik');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('draft', 'queued', 'processing', 'review', 'delivering', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."page_kind" AS ENUM('key', 'student');--> statement-breakpoint
CREATE TYPE "public"."page_status" AS ENUM('uploaded', 'queued', 'reading', 'read', 'failed');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"event" text NOT NULL,
	"page" text DEFAULT '' NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"value" double precision,
	"visitor" text DEFAULT '' NOT NULL,
	"session" text DEFAULT '' NOT NULL,
	"ref" text DEFAULT '' NOT NULL,
	"utm" text DEFAULT '' NOT NULL,
	"vw" double precision,
	"ua" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"mode" "exam_mode" DEFAULT 'optik' NOT NULL,
	"status" "job_status" DEFAULT 'draft' NOT NULL,
	"roster" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"klasik_max" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reserved_pages" integer DEFAULT 0 NOT NULL,
	"consent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"delivery_attempt_at" timestamp with time zone,
	"notified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"ref" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"kind" "page_kind" NOT NULL,
	"seq" integer NOT NULL,
	"file_path" text,
	"status" "page_status" DEFAULT 'uploaded' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lease_until" timestamp with time zone,
	"result" jsonb,
	"override" jsonb,
	"error" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"pack" text NOT NULL,
	"pages" integer NOT NULL,
	"amount_kurus" integer NOT NULL,
	"provider_token" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	CONSTRAINT "payments_provider_token_unique" UNIQUE("provider_token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"page_balance" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_ts" ON "events" USING btree ("ts");--> statement-breakpoint
CREATE INDEX "jobs_user" ON "jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "jobs_status" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_reason_ref" ON "ledger" USING btree ("reason","ref");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_job_kind_seq" ON "pages" USING btree ("job_id","kind","seq");--> statement-breakpoint
CREATE INDEX "pages_status" ON "pages" USING btree ("status","lease_until");