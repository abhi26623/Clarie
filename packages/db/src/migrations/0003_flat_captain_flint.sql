DO $$ BEGIN
 CREATE TYPE "public"."approval_decision" AS ENUM('approved', 'rejected', 'needs_changes');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."issue_type" AS ENUM('REQUIREMENT_MISMATCH', 'MISSING_ACCEPTANCE', 'EDGE_CASE_MISSED', 'SECURITY', 'PERFORMANCE', 'CODE_QUALITY', 'MISSING_TESTS');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."pr_state" AS ENUM('open', 'closed', 'merged');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."review_status" AS ENUM('running', 'completed', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."task_priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."task_type" AS ENUM('FEATURE', 'BUG', 'CHORE', 'TEST', 'DOCS');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"feature_request_id" integer,
	"pull_request_id" integer NOT NULL,
	"status" "review_status" NOT NULL,
	"summary" text,
	"passed" boolean,
	"confidence" integer,
	"model" text,
	"review_number" integer DEFAULT 1,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approvals" (
	"id" serial PRIMARY KEY NOT NULL,
	"feature_request_id" integer NOT NULL,
	"reviewer_id" text NOT NULL,
	"decision" "approval_decision" NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"razorpay_order_id" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"status" text NOT NULL,
	"plan" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pull_request_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"pull_request_id" integer NOT NULL,
	"path" text NOT NULL,
	"status" text NOT NULL,
	"additions" integer NOT NULL,
	"deletions" integer NOT NULL,
	"patch" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pull_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"repository_id" integer NOT NULL,
	"feature_request_id" integer,
	"github_pr_number" integer NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"state" "pr_state" NOT NULL,
	"author_login" text,
	"source_branch" text,
	"target_branch" text,
	"github_url" text,
	"last_commit_sha" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "repositories" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"full_name" text NOT NULL,
	"name" text NOT NULL,
	"github_id" integer,
	"installation_id" integer,
	"webhook_active" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "review_issues" (
	"id" serial PRIMARY KEY NOT NULL,
	"review_id" integer NOT NULL,
	"type" "issue_type" NOT NULL,
	"severity" "severity" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"suggestion" text,
	"file_path" text,
	"line_number" integer,
	"resolved" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"feature_request_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" "task_type" NOT NULL,
	"priority" "task_priority" NOT NULL,
	"status" "task_status" DEFAULT 'todo' NOT NULL,
	"assignee_id" text,
	"assigned_to_ai" boolean DEFAULT false,
	"estimated_hours" integer,
	"suggested_branch" text,
	"order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb NOT NULL,
	"signature_valid" boolean NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "clarification_threads" ALTER COLUMN "feature_request_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "clarification_threads" ALTER COLUMN "question" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "feature_requests" ALTER COLUMN "status" SET DATA TYPE feature_status;--> statement-breakpoint
ALTER TABLE "feature_requests" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "prds" ALTER COLUMN "feature_request_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "prds" ALTER COLUMN "goals" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "prds" ALTER COLUMN "non_goals" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "prds" ALTER COLUMN "user_stories" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "prds" ALTER COLUMN "acceptance_criteria" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "prds" ALTER COLUMN "edge_cases" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "prds" ALTER COLUMN "success_metrics" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "prds" ALTER COLUMN "approved" SET DATA TYPE boolean;--> statement-breakpoint
ALTER TABLE "prds" ALTER COLUMN "approved" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "workflow_steps" ALTER COLUMN "status" SET DATA TYPE step_status;--> statement-breakpoint
ALTER TABLE "workspace_settings" ALTER COLUMN "plan" SET DEFAULT 'FREE';--> statement-breakpoint
ALTER TABLE "clarification_threads" ADD COLUMN "question_type" text DEFAULT 'TEXT' NOT NULL;--> statement-breakpoint
ALTER TABLE "clarification_threads" ADD COLUMN "asked_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "clarification_threads" ADD COLUMN "answered_at" timestamp;--> statement-breakpoint
ALTER TABLE "feature_requests" ADD COLUMN "linked_feature_id" integer;--> statement-breakpoint
ALTER TABLE "feature_requests" ADD COLUMN "time_to_ship_days" integer;--> statement-breakpoint
ALTER TABLE "feature_requests" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "prds" ADD COLUMN "version" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "workflow_steps" ADD COLUMN "duration_ms" integer;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "ai_credits_limit" integer DEFAULT 500 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_reviews" ADD CONSTRAINT "ai_reviews_feature_request_id_feature_requests_id_fk" FOREIGN KEY ("feature_request_id") REFERENCES "public"."feature_requests"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_reviews" ADD CONSTRAINT "ai_reviews_pull_request_id_pull_requests_id_fk" FOREIGN KEY ("pull_request_id") REFERENCES "public"."pull_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approvals" ADD CONSTRAINT "approvals_feature_request_id_feature_requests_id_fk" FOREIGN KEY ("feature_request_id") REFERENCES "public"."feature_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approvals" ADD CONSTRAINT "approvals_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pull_request_files" ADD CONSTRAINT "pull_request_files_pull_request_id_pull_requests_id_fk" FOREIGN KEY ("pull_request_id") REFERENCES "public"."pull_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_feature_request_id_feature_requests_id_fk" FOREIGN KEY ("feature_request_id") REFERENCES "public"."feature_requests"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "repositories" ADD CONSTRAINT "repositories_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "review_issues" ADD CONSTRAINT "review_issues_review_id_ai_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."ai_reviews"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_feature_request_id_feature_requests_id_fk" FOREIGN KEY ("feature_request_id") REFERENCES "public"."feature_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_organization_id_unique" UNIQUE("organization_id");