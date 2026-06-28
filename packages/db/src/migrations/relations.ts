import { relations } from "drizzle-orm/relations";
import { organization, featureRequests, clarificationThreads, prds, workspaceSettings, invitation, user, member, session, account } from "./schema";

export const featureRequestsRelations = relations(featureRequests, ({one, many}) => ({
	organization: one(organization, {
		fields: [featureRequests.organizationId],
		references: [organization.id]
	}),
	clarificationThreads: many(clarificationThreads),
	prds: many(prds),
}));

export const organizationRelations = relations(organization, ({many}) => ({
	featureRequests: many(featureRequests),
	workspaceSettings: many(workspaceSettings),
	invitations: many(invitation),
	members: many(member),
}));

export const clarificationThreadsRelations = relations(clarificationThreads, ({one}) => ({
	featureRequest: one(featureRequests, {
		fields: [clarificationThreads.featureRequestId],
		references: [featureRequests.id]
	}),
}));

export const prdsRelations = relations(prds, ({one}) => ({
	featureRequest: one(featureRequests, {
		fields: [prds.featureRequestId],
		references: [featureRequests.id]
	}),
}));

export const workspaceSettingsRelations = relations(workspaceSettings, ({one}) => ({
	organization: one(organization, {
		fields: [workspaceSettings.organizationId],
		references: [organization.id]
	}),
}));

export const invitationRelations = relations(invitation, ({one}) => ({
	organization: one(organization, {
		fields: [invitation.organizationId],
		references: [organization.id]
	}),
	user: one(user, {
		fields: [invitation.inviterId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	invitations: many(invitation),
	members: many(member),
	sessions: many(session),
	accounts: many(account),
}));

export const memberRelations = relations(member, ({one}) => ({
	organization: one(organization, {
		fields: [member.organizationId],
		references: [organization.id]
	}),
	user: one(user, {
		fields: [member.userId],
		references: [user.id]
	}),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));