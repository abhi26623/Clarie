ALTER TABLE "approvals" DROP CONSTRAINT "approvals_reviewer_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_created_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "ai_reviews" ADD COLUMN "criteria_verdicts" jsonb;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "approvals" ADD CONSTRAINT "approvals_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feature_requests" ADD CONSTRAINT "feature_requests_linked_feature_id_fk" FOREIGN KEY ("linked_feature_id") REFERENCES "public"."feature_requests"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_pr_review_number" ON "ai_reviews" USING btree ("pull_request_id","review_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_repo_pr" ON "pull_requests" USING btree ("repository_id","github_pr_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_github_installation" ON "repositories" USING btree ("github_id","installation_id") WHERE "repositories"."github_id" IS NOT NULL AND "repositories"."installation_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "prds" ADD CONSTRAINT "prds_feature_request_id_unique" UNIQUE("feature_request_id");--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_github_installation_id_unique" UNIQUE("github_installation_id");