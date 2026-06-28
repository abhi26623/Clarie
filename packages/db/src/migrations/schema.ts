import { pgTable, foreignKey, serial, text, timestamp, integer, jsonb, unique, index, boolean, uniqueIndex, pgEnum } from "drizzle-orm/pg-core"
  import { sql } from "drizzle-orm"

export const featureStatus = pgEnum("feature_status", ['received', 'analyzing', 'clarification_needed', 'accepted', 'duplicate', 'feature_exists', 'bug_report', 'out_of_scope', 'prd_generating', 'prd_ready', 'tasks_generating', 'tasks_ready', 'in_development', 'in_review', 'fix_needed', 'ready_for_approval', 'shipped', 'rejected', 'failed'])
export const severity = pgEnum("severity", ['BLOCKING', 'NON_BLOCKING', 'SUGGESTION'])
export const stepStatus = pgEnum("step_status", ['running', 'done', 'failed'])
export const taskStatus = pgEnum("task_status", ['todo', 'in_progress', 'in_review', 'done'])



export const featureRequests = pgTable("feature_requests", {
	id: serial("id").primaryKey().notNull(),
	organizationId: text("organization_id").notNull(),
	source: text("source"),
	submitterName: text("submitter_name"),
	submitterEmail: text("submitter_email"),
	title: text("title").notNull(),
	body: text("body").notNull(),
	status: text("status").default('received'),
	aiDecision: text("ai_decision"),
	aiReasoning: text("ai_reasoning"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		featureRequestsOrganizationIdOrganizationIdFk: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organization.id],
			name: "feature_requests_organization_id_organization_id_fk"
		}).onDelete("cascade"),
	}
});

export const clarificationThreads = pgTable("clarification_threads", {
	id: serial("id").primaryKey().notNull(),
	featureRequestId: integer("feature_request_id"),
	question: text("question"),
	options: jsonb("options"),
	answer: text("answer"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		clarificationThreadsFeatureRequestIdFeatureRequestsIdFk: foreignKey({
			columns: [table.featureRequestId],
			foreignColumns: [featureRequests.id],
			name: "clarification_threads_feature_request_id_feature_requests_id_fk"
		}).onDelete("cascade"),
	}
});

export const prds = pgTable("prds", {
	id: serial("id").primaryKey().notNull(),
	featureRequestId: integer("feature_request_id"),
	problemStatement: text("problem_statement"),
	goals: text("goals"),
	nonGoals: text("non_goals"),
	userStories: text("user_stories"),
	acceptanceCriteria: text("acceptance_criteria"),
	edgeCases: text("edge_cases"),
	successMetrics: text("success_metrics"),
	approved: text("approved"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
},
(table) => {
	return {
		prdsFeatureRequestIdFeatureRequestsIdFk: foreignKey({
			columns: [table.featureRequestId],
			foreignColumns: [featureRequests.id],
			name: "prds_feature_request_id_feature_requests_id_fk"
		}).onDelete("cascade"),
	}
});

export const workflowSteps = pgTable("workflow_steps", {
	id: serial("id").primaryKey().notNull(),
	entityType: text("entity_type").notNull(),
	entityId: text("entity_id").notNull(),
	step: text("step").notNull(),
	status: text("status").notNull(),
	partialResult: jsonb("partial_result"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const workspaceSettings = pgTable("workspace_settings", {
	id: serial("id").primaryKey().notNull(),
	organizationId: text("organization_id").notNull(),
	productDescription: text("product_description"),
	portalSlug: text("portal_slug"),
	plan: text("plan").default('free').notNull(),
	aiCreditsUsed: integer("ai_credits_used").default(0).notNull(),
	repoLimit: integer("repo_limit").default(3).notNull(),
	billingStatus: text("billing_status").default('active').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		workspaceSettingsOrganizationIdOrganizationIdFk: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organization.id],
			name: "workspace_settings_organization_id_organization_id_fk"
		}).onDelete("cascade"),
		workspaceSettingsPortalSlugUnique: unique("workspace_settings_portal_slug_unique").on(table.portalSlug),
	}
});

export const invitation = pgTable("invitation", {
	id: text("id").primaryKey().notNull(),
	organizationId: text("organization_id").notNull(),
	email: text("email").notNull(),
	role: text("role"),
	status: text("status").default('pending').notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	inviterId: text("inviter_id").notNull(),
},
(table) => {
	return {
		emailIdx: index("invitation_email_idx").using("btree", table.email.asc().nullsLast()),
		organizationIdIdx: index("invitation_organizationId_idx").using("btree", table.organizationId.asc().nullsLast()),
		invitationOrganizationIdOrganizationIdFk: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organization.id],
			name: "invitation_organization_id_organization_id_fk"
		}).onDelete("cascade"),
		invitationInviterIdUserIdFk: foreignKey({
			columns: [table.inviterId],
			foreignColumns: [user.id],
			name: "invitation_inviter_id_user_id_fk"
		}).onDelete("cascade"),
	}
});

export const member = pgTable("member", {
	id: text("id").primaryKey().notNull(),
	organizationId: text("organization_id").notNull(),
	userId: text("user_id").notNull(),
	role: text("role").default('member').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
},
(table) => {
	return {
		organizationIdIdx: index("member_organizationId_idx").using("btree", table.organizationId.asc().nullsLast()),
		userIdIdx: index("member_userId_idx").using("btree", table.userId.asc().nullsLast()),
		memberOrganizationIdOrganizationIdFk: foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organization.id],
			name: "member_organization_id_organization_id_fk"
		}).onDelete("cascade"),
		memberUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "member_user_id_user_id_fk"
		}).onDelete("cascade"),
	}
});

export const session = pgTable("session", {
	id: text("id").primaryKey().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	token: text("token").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id").notNull(),
	activeOrganizationId: text("active_organization_id"),
},
(table) => {
	return {
		userIdIdx: index("session_userId_idx").using("btree", table.userId.asc().nullsLast()),
		sessionUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "session_user_id_user_id_fk"
		}).onDelete("cascade"),
		sessionTokenUnique: unique("session_token_unique").on(table.token),
	}
});

export const user = pgTable("user", {
	id: text("id").primaryKey().notNull(),
	name: text("name").notNull(),
	email: text("email").notNull(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text("image"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		userEmailUnique: unique("user_email_unique").on(table.email),
	}
});

export const verification = pgTable("verification", {
	id: text("id").primaryKey().notNull(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		identifierIdx: index("verification_identifier_idx").using("btree", table.identifier.asc().nullsLast()),
	}
});

export const organization = pgTable("organization", {
	id: text("id").primaryKey().notNull(),
	name: text("name").notNull(),
	slug: text("slug").notNull(),
	logo: text("logo"),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	metadata: text("metadata"),
},
(table) => {
	return {
		slugUidx: uniqueIndex("organization_slug_uidx").using("btree", table.slug.asc().nullsLast()),
		organizationSlugUnique: unique("organization_slug_unique").on(table.slug),
	}
});

export const account = pgTable("account", {
	id: text("id").primaryKey().notNull(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id").notNull(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: 'string' }),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: 'string' }),
	scope: text("scope"),
	password: text("password"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
},
(table) => {
	return {
		userIdIdx: index("account_userId_idx").using("btree", table.userId.asc().nullsLast()),
		accountUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "account_user_id_user_id_fk"
		}).onDelete("cascade"),
	}
});