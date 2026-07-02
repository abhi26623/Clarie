import {
  pgTable,
  foreignKey,
  serial,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organization, user } from "./auth-schema";

/* ---------- Enums ---------- */

export const featureStatus = pgEnum("feature_status", [
  "received", "analyzing", "clarification_needed", "accepted", "duplicate",
  "feature_exists", "bug_report", "out_of_scope", "prd_generating", "prd_ready",
  "tasks_generating", "tasks_ready", "in_development", "in_review", "fix_needed",
  "ready_for_approval", "shipped", "rejected", "failed",
]);
export const stepStatus = pgEnum("step_status", ["running", "done", "failed"]);
export const severity = pgEnum("severity", ["BLOCKING", "NON_BLOCKING", "SUGGESTION"]);
export const taskStatus = pgEnum("task_status", ["todo", "in_progress", "in_review", "done"]);
export const taskType = pgEnum("task_type", ["FEATURE", "BUG", "CHORE", "TEST", "DOCS"]);
export const taskPriority = pgEnum("task_priority", ["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const prState = pgEnum("pr_state", ["open", "closed", "merged"]);
export const reviewStatus = pgEnum("review_status", ["running", "completed", "failed"]);
export const issueType = pgEnum("issue_type", [
  "REQUIREMENT_MISMATCH", "MISSING_ACCEPTANCE", "EDGE_CASE_MISSED",
  "SECURITY", "PERFORMANCE", "CODE_QUALITY", "MISSING_TESTS",
]);
export const approvalDecision = pgEnum("approval_decision", ["approved", "rejected", "needs_changes"]);

/* ---------- Core: feature requests ---------- */

export const featureRequests = pgTable("feature_requests", {
  id: serial("id").primaryKey().notNull(),
  organizationId: text("organization_id").notNull(),
  source: text("source"),
  submitterName: text("submitter_name"),
  submitterEmail: text("submitter_email"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  status: featureStatus("status").default("received").notNull(),
  aiDecision: text("ai_decision"),
  aiReasoning: text("ai_reasoning"),
  // links a DUPLICATE / EXISTS request to the existing feature it matches
  linkedFeatureId: integer("linked_feature_id"),
  timeToShipDays: integer("time_to_ship_days"),
  trackingToken: text("tracking_token"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
}, (table) => ({
  idx_fr_org_created: index("idx_fr_org_created").on(table.organizationId, table.createdAt),
  idx_fr_org_status: index("idx_fr_org_status").on(table.organizationId, table.status),
  featureRequestsOrgIdOrganizationIdFk: foreignKey({
    columns: [table.organizationId],
    foreignColumns: [organization.id],
    name: "feature_requests_organization_id_organization_id_fk",
  }).onDelete("cascade"),
  linkedFeatureFk: foreignKey({
    columns: [table.linkedFeatureId],
    foreignColumns: [table.id],
    name: "feature_requests_linked_feature_id_fk",
  }).onDelete("set null"),
}));

/* ---------- Workflow steps (live progress) ---------- */

export const workflowSteps = pgTable("workflow_steps", {
  id: serial("id").primaryKey().notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  step: text("step").notNull(),
  status: stepStatus("status").notNull(),
  durationMs: integer("duration_ms"),
  partialResult: jsonb("partial_result"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (table) => ({
  idx_ws_entity_step: index("idx_ws_entity_step").on(table.entityType, table.entityId, table.step),
}));

/* ---------- Clarification threads ---------- */
/* VERIFY against existing file before overwriting */

export const clarificationThreads = pgTable("clarification_threads", {
  id: serial("id").primaryKey().notNull(),
  featureRequestId: integer("feature_request_id").notNull(),
  question: text("question").notNull(),
  questionType: text("question_type").default("TEXT").notNull(), // TEXT | CHOICE | YESNO
  options: jsonb("options"),
  answer: text("answer"),
  askedAt: timestamp("asked_at", { mode: "string" }).defaultNow(),
  answeredAt: timestamp("answered_at", { mode: "string" }),
  // Merged from current schema
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (table) => ({
  clarificationThreadsFeatureRequestIdFk: foreignKey({
    columns: [table.featureRequestId],
    foreignColumns: [featureRequests.id],
    name: "clarification_threads_feature_request_id_feature_requests_id_fk",
  }).onDelete("cascade"),
}));

/* ---------- PRDs ---------- */
/* VERIFY against existing file before overwriting */

export const prds = pgTable("prds", {
  id: serial("id").primaryKey().notNull(),
  featureRequestId: integer("feature_request_id").notNull().unique(),
  problemStatement: text("problem_statement"),
  goals: jsonb("goals"),
  nonGoals: jsonb("non_goals"),
  userStories: jsonb("user_stories"),
  acceptanceCriteria: jsonb("acceptance_criteria"),
  edgeCases: jsonb("edge_cases"),
  successMetrics: jsonb("success_metrics"),
  approved: boolean("approved").default(false),
  version: integer("version").default(1),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (table) => ({
  prdsFeatureRequestIdFk: foreignKey({
    columns: [table.featureRequestId],
    foreignColumns: [featureRequests.id],
    name: "prds_feature_request_id_feature_requests_id_fk",
  }).onDelete("cascade"),
}));

/* ---------- Workspace settings ---------- */
/* VERIFY against existing file before overwriting */

export const workspaceSettings = pgTable("workspace_settings", {
  id: serial("id").primaryKey().notNull(),
  organizationId: text("organization_id").notNull().unique(),
  productDescription: text("product_description"),
  portalSlug: text("portal_slug").unique(),
  plan: text("plan").default("FREE").notNull(),
  aiCreditsUsed: integer("ai_credits_used").default(0).notNull(),
  aiCreditsLimit: integer("ai_credits_limit").default(500).notNull(),
  repoLimit: integer("repo_limit").default(3).notNull(),
  memberLimit: integer("member_limit").default(10).notNull(),
  billingStatus: text("billing_status").default("active").notNull(),
  // GitHub App installation — one per org, persisted after completeInstallation
  githubInstallationId: integer("github_installation_id").unique(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
}, (table) => ({
  workspaceSettingsOrgIdOrganizationIdFk: foreignKey({
    columns: [table.organizationId],
    foreignColumns: [organization.id],
    name: "workspace_settings_organization_id_organization_id_fk",
  }).onDelete("cascade"),
}));

/* ---------- Tasks ---------- */

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey().notNull(),
  featureRequestId: integer("feature_request_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  type: taskType("type").notNull(),
  priority: taskPriority("priority").notNull(),
  status: taskStatus("status").default("todo").notNull(),
  assigneeId: text("assignee_id"),
  assignedToAI: boolean("assigned_to_ai").default(false),
  estimatedHours: integer("estimated_hours"),
  suggestedBranch: text("suggested_branch"),
  order: integer("order").default(0),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (table) => ({
  idx_task_feature: index("idx_task_feature").on(table.featureRequestId),
  tasksFeatureRequestIdFk: foreignKey({
    columns: [table.featureRequestId],
    foreignColumns: [featureRequests.id],
    name: "tasks_feature_request_id_feature_requests_id_fk",
  }).onDelete("cascade"),
  tasksAssigneeIdUserIdFk: foreignKey({
    columns: [table.assigneeId],
    foreignColumns: [user.id],
    name: "tasks_assignee_id_user_id_fk",
  }).onDelete("set null"),
}));

/* ---------- Repositories ---------- */

export const repositories = pgTable("repositories", {
  id: serial("id").primaryKey().notNull(),
  organizationId: text("organization_id").notNull(),
  fullName: text("full_name").notNull(),
  name: text("name").notNull(),
  githubId: integer("github_id"),
  installationId: integer("installation_id"),
  webhookActive: boolean("webhook_active").default(false),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (table) => ({
  repositoriesOrgIdOrganizationIdFk: foreignKey({
    columns: [table.organizationId],
    foreignColumns: [organization.id],
    name: "repositories_organization_id_organization_id_fk",
  }).onDelete("cascade"),
  uniqueGithubInstallation: uniqueIndex("unique_github_installation")
    .on(table.githubId, table.installationId)
    .where(sql`${table.githubId} IS NOT NULL AND ${table.installationId} IS NOT NULL`),
}));

/* ---------- Pull requests ---------- */

export const pullRequests = pgTable("pull_requests", {
  id: serial("id").primaryKey().notNull(),
  repositoryId: integer("repository_id").notNull(),
  featureRequestId: integer("feature_request_id"),
  githubPrNumber: integer("github_pr_number").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  state: prState("state").notNull(),
  authorLogin: text("author_login"),
  sourceBranch: text("source_branch"),
  targetBranch: text("target_branch"),
  githubUrl: text("github_url"),
  lastCommitSha: text("last_commit_sha"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (table) => ({
  pullRequestsRepositoryIdFk: foreignKey({
    columns: [table.repositoryId],
    foreignColumns: [repositories.id],
    name: "pull_requests_repository_id_repositories_id_fk",
  }).onDelete("cascade"),
  pullRequestsFeatureRequestIdFk: foreignKey({
    columns: [table.featureRequestId],
    foreignColumns: [featureRequests.id],
    name: "pull_requests_feature_request_id_feature_requests_id_fk",
  }).onDelete("set null"),
  uniqueRepoPr: uniqueIndex("unique_repo_pr")
    .on(table.repositoryId, table.githubPrNumber),
}));

/* ---------- Pull request files ---------- */

export const pullRequestFiles = pgTable("pull_request_files", {
  id: serial("id").primaryKey().notNull(),
  pullRequestId: integer("pull_request_id").notNull(),
  path: text("path").notNull(),
  status: text("status").notNull(),
  additions: integer("additions").notNull(),
  deletions: integer("deletions").notNull(),
  patch: text("patch"),
}, (table) => ({
  pullRequestFilesPullRequestIdFk: foreignKey({
    columns: [table.pullRequestId],
    foreignColumns: [pullRequests.id],
    name: "pull_request_files_pull_request_id_pull_requests_id_fk",
  }).onDelete("cascade"),
}));

/* ---------- AI reviews ---------- */

export const aiReviews = pgTable("ai_reviews", {
  id: serial("id").primaryKey().notNull(),
  featureRequestId: integer("feature_request_id"),
  pullRequestId: integer("pull_request_id").notNull(),
  status: reviewStatus("status").notNull(),
  summary: text("summary"),
  passed: boolean("passed"),
  confidence: integer("confidence"),
  criteriaVerdicts: jsonb("criteria_verdicts"),
  model: text("model"),
  reviewNumber: integer("review_number").default(1),
  completedAt: timestamp("completed_at", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (table) => ({
  aiReviewsFeatureRequestIdFk: foreignKey({
    columns: [table.featureRequestId],
    foreignColumns: [featureRequests.id],
    name: "ai_reviews_feature_request_id_feature_requests_id_fk",
  }).onDelete("set null"),
  aiReviewsPullRequestIdFk: foreignKey({
    columns: [table.pullRequestId],
    foreignColumns: [pullRequests.id],
    name: "ai_reviews_pull_request_id_pull_requests_id_fk",
  }).onDelete("cascade"),
  uniquePrReviewNumber: uniqueIndex("unique_pr_review_number")
    .on(table.pullRequestId, table.reviewNumber),
}));

/* ---------- Review issues ---------- */

export const reviewIssues = pgTable("review_issues", {
  id: serial("id").primaryKey().notNull(),
  reviewId: integer("review_id").notNull(),
  type: issueType("type").notNull(),
  severity: severity("severity").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  suggestion: text("suggestion"),
  filePath: text("file_path"),
  lineNumber: integer("line_number"),
  resolved: boolean("resolved").default(false),
}, (table) => ({
  reviewIssuesReviewIdFk: foreignKey({
    columns: [table.reviewId],
    foreignColumns: [aiReviews.id],
    name: "review_issues_review_id_ai_reviews_id_fk",
  }).onDelete("cascade"),
}));

/* ---------- Approvals ---------- */

export const approvals = pgTable("approvals", {
  id: serial("id").primaryKey().notNull(),
  featureRequestId: integer("feature_request_id").notNull(),
  reviewerId: text("reviewer_id").notNull(),
  decision: approvalDecision("decision").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (table) => ({
  approvalsFeatureRequestIdFk: foreignKey({
    columns: [table.featureRequestId],
    foreignColumns: [featureRequests.id],
    name: "approvals_feature_request_id_feature_requests_id_fk",
  }).onDelete("cascade"),
  approvalsReviewerIdUserIdFk: foreignKey({
    columns: [table.reviewerId],
    foreignColumns: [user.id],
    name: "approvals_reviewer_id_user_id_fk",
  }).onDelete("restrict"),
}));

/* ---------- Billing orders ---------- */

export const billingOrders = pgTable("billing_orders", {
  id: serial("id").primaryKey().notNull(),
  organizationId: text("organization_id").notNull(),
  razorpayOrderId: text("razorpay_order_id").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").default("INR").notNull(),
  status: text("status").notNull(),
  plan: text("plan").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (table) => ({
  billingOrdersOrgIdOrganizationIdFk: foreignKey({
    columns: [table.organizationId],
    foreignColumns: [organization.id],
    name: "billing_orders_organization_id_organization_id_fk",
  }).onDelete("cascade"),
}));

/* ---------- Payments (Razorpay Upgrade) ---------- */

export const payments = pgTable("payments", {
  id: serial("id").primaryKey().notNull(),
  organizationId: text("organization_id").notNull(),
  razorpayOrderId: text("razorpay_order_id").unique().notNull(),
  razorpayPaymentId: text("razorpay_payment_id").unique(),
  amount: integer("amount").notNull(),
  currency: text("currency").default("INR").notNull(),
  status: text("status").notNull(), // 'created' | 'paid' | 'failed'
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  paidAt: timestamp("paid_at", { mode: "string" }),
}, (table) => ({
  paymentsOrgIdOrganizationIdFk: foreignKey({
    columns: [table.organizationId],
    foreignColumns: [organization.id],
    name: "payments_organization_id_organization_id_fk",
  }).onDelete("cascade"),
  paymentsCreatedByUserIdFk: foreignKey({
    columns: [table.createdBy],
    foreignColumns: [user.id],
    name: "payments_created_by_user_id_fk",
  }).onDelete("restrict"),
}));

/* ---------- Webhook logs (replay safety net) ---------- */

export const webhookLogs = pgTable("webhook_logs", {
  id: serial("id").primaryKey().notNull(),
  source: text("source").notNull(),
  event: text("event").notNull(),
  payload: jsonb("payload").notNull(),
  signatureValid: boolean("signature_valid").notNull(),
  processedAt: timestamp("processed_at", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
});

/* ---------- Invite links ---------- */

export const inviteLinks = pgTable("invite_links", {
  token: text("token").primaryKey().notNull(),
  organizationId: text("organization_id").notNull(),
  expiresAt: timestamp("expires_at", { mode: "string" }).notNull(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
}, (table) => ({
  inviteLinksOrgIdFk: foreignKey({
    columns: [table.organizationId],
    foreignColumns: [organization.id],
    name: "invite_links_organization_id_fk",
  }).onDelete("cascade"),
  inviteLinksCreatedByFk: foreignKey({
    columns: [table.createdBy],
    foreignColumns: [user.id],
    name: "invite_links_created_by_user_id_fk",
  }).onDelete("set null"),
}));

/* ---------- Relations ---------- */

export const featureRequestsRelations = relations(featureRequests, ({ many, one }) => ({
  // ⚠️  workflowSteps uses a polymorphic (entityType, entityId: text) pattern with NO typed FK.
  // Drizzle cannot infer the join — do NOT use `with: { workflowSteps }` in queries; it will 500.
  // Query directly: db.select().from(workflowSteps).where(eq(workflowSteps.entityId, String(id)))

  clarificationThreads: many(clarificationThreads),
  prd: one(prds, { fields: [featureRequests.id], references: [prds.featureRequestId] }),
  tasks: many(tasks),
  pullRequests: many(pullRequests),
  aiReviews: many(aiReviews),
  approvals: many(approvals),
}));

export const clarificationThreadsRelations = relations(clarificationThreads, ({ one }) => ({
  featureRequest: one(featureRequests, {
    fields: [clarificationThreads.featureRequestId],
    references: [featureRequests.id],
  }),
}));

export const prdsRelations = relations(prds, ({ one }) => ({
  featureRequest: one(featureRequests, {
    fields: [prds.featureRequestId],
    references: [featureRequests.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  featureRequest: one(featureRequests, {
    fields: [tasks.featureRequestId],
    references: [featureRequests.id],
  }),
  assignee: one(user, { fields: [tasks.assigneeId], references: [user.id] }),
}));

export const repositoriesRelations = relations(repositories, ({ many }) => ({
  pullRequests: many(pullRequests),
}));

export const pullRequestsRelations = relations(pullRequests, ({ one, many }) => ({
  repository: one(repositories, {
    fields: [pullRequests.repositoryId],
    references: [repositories.id],
  }),
  featureRequest: one(featureRequests, {
    fields: [pullRequests.featureRequestId],
    references: [featureRequests.id],
  }),
  files: many(pullRequestFiles),
  aiReviews: many(aiReviews),
}));

export const pullRequestFilesRelations = relations(pullRequestFiles, ({ one }) => ({
  pullRequest: one(pullRequests, {
    fields: [pullRequestFiles.pullRequestId],
    references: [pullRequests.id],
  }),
}));

export const aiReviewsRelations = relations(aiReviews, ({ one, many }) => ({
  featureRequest: one(featureRequests, {
    fields: [aiReviews.featureRequestId],
    references: [featureRequests.id],
  }),
  pullRequest: one(pullRequests, {
    fields: [aiReviews.pullRequestId],
    references: [pullRequests.id],
  }),
  issues: many(reviewIssues),
}));

export const reviewIssuesRelations = relations(reviewIssues, ({ one }) => ({
  review: one(aiReviews, { fields: [reviewIssues.reviewId], references: [aiReviews.id] }),
}));

export const approvalsRelations = relations(approvals, ({ one }) => ({
  featureRequest: one(featureRequests, {
    fields: [approvals.featureRequestId],
    references: [featureRequests.id],
  }),
  reviewer: one(user, { fields: [approvals.reviewerId], references: [user.id] }),
}));

export * from "./auth-schema";