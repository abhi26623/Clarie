DO $$ BEGIN
 CREATE TYPE "public"."feature_status" AS ENUM('received', 'analyzing', 'clarification_needed', 'accepted', 'duplicate', 'feature_exists', 'bug_report', 'out_of_scope', 'prd_generating', 'prd_ready', 'tasks_generating', 'tasks_ready', 'in_development', 'in_review', 'fix_needed', 'ready_for_approval', 'shipped', 'rejected', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."severity" AS ENUM('BLOCKING', 'NON_BLOCKING', 'SUGGESTION');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."step_status" AS ENUM('running', 'done', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."task_status" AS ENUM('todo', 'in_progress', 'in_review', 'done');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
/* 
    Unfortunately in current drizzle-kit version we can't automatically get name for primary key.
    We are working on making it available!

    Meanwhile you can:
        1. Check pk name in your database, by running
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_schema = 'public'
                AND table_name = 'workspace_settings'
                AND constraint_type = 'PRIMARY KEY';
        2. Uncomment code below and paste pk name manually
        
    Hope to release this update as soon as possible
*/

-- ALTER TABLE "workspace_settings" DROP CONSTRAINT "<constraint_name>";--> statement-breakpoint
ALTER TABLE "workspace_settings" ALTER COLUMN "plan" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_settings" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "clarification_threads" ADD COLUMN "answer" text;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "id" serial PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "ai_credits_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "repo_limit" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD COLUMN "billing_status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "feature_requests" DROP COLUMN IF EXISTS "updated_at";--> statement-breakpoint
ALTER TABLE "prds" DROP COLUMN IF EXISTS "content";