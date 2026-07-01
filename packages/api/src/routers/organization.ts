import { z } from "zod";
import { router, protectedProcedure, protectedOrgProcedure } from "../trpc";
import { auth } from "@claire/auth";
import { db, workspaceSettings, organization, member, user, session } from "@claire/db";
import type { Auth } from "@claire/auth";
import { TRPCError } from "@trpc/server";
import { eq, and, sql } from "drizzle-orm";
import { featureRequests, repositories, invitation, inviteLinks } from "@claire/db";
import { DEMO_EMAIL } from "@claire/auth/demo";

const RESERVED_SLUGS = new Set([
  "demo", "claire-demo", "api", "dashboard", "sign-in", "sign-up", "join", 
  "p", "onboarding", "settings", "auth", "webhooks", "app"
]);

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

export const organizationRouter = router({
  create: protectedProcedure
    .input(z.object({ name: z.string(), slug: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.session.user.email === DEMO_EMAIL) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Demo accounts cannot create workspaces." });
      }
      let baseSlug = input.slug ? slugify(input.slug) : slugify(input.name);
      if (!baseSlug) baseSlug = "org";
      
      let candidate = baseSlug;
      let counter = 0;
      
      while (true) {
        if (counter > 0) candidate = `${baseSlug}-${counter}`;
        
        if (RESERVED_SLUGS.has(candidate)) {
          counter++;
          continue;
        }

        const [existingWorkspace] = await db.select().from(workspaceSettings).where(eq(workspaceSettings.portalSlug, candidate));
        if (existingWorkspace) {
          counter++;
          continue;
        }
        
        const [existingOrg] = await db.select().from(organization).where(eq(organization.slug, candidate));
        if (existingOrg) {
          counter++;
          continue;
        }

        break;
      }

      const finalSlug = candidate;

      let res;
      try {
        res = await (auth as Auth).api.createOrganization({
          headers: ctx.headers,
          body: { name: input.name, slug: finalSlug },
        });
      } catch (err: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create organization" });
      }

      if (!res?.id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // ⭐ Explicit membership safety guard — ensure creator has "owner" role
      // regardless of BetterAuth's auto-assignment behavior.
      await db.insert(member).values({
        id: `${ctx.session.user.id}-${res.id}`,
        organizationId: res.id,
        userId: ctx.session.user.id,
        role: "owner",
        createdAt: new Date(),
      }).onConflictDoNothing();

      await (auth as Auth).api.setActiveOrganization({
        headers: ctx.headers,
        body: { organizationId: res.id },
      });

      // ⭐ HARD CREDIT SEEDING: all FREE defaults explicit — never null.
      // A null aiCreditsLimit makes every AI action fail with CreditsExhaustedError.
      await db.insert(workspaceSettings).values({
        organizationId: res.id,
        portalSlug: finalSlug,
        plan: "FREE",
        aiCreditsUsed: 0,
        aiCreditsLimit: 500,
        repoLimit: 3,
        memberLimit: 10,
        billingStatus: "active",
      }).onConflictDoNothing({ target: workspaceSettings.organizationId });

      return res;
    }),

  switchActive: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await (auth as Auth).api.setActiveOrganization({
        headers: ctx.headers,
        body: { organizationId: input.organizationId },
      });
      return { success: true };
    }),

  list: protectedProcedure
    .query(async ({ ctx }) => {
      const members = await db.select({
        organization: organization,
      })
      .from(member)
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .where(eq(member.userId, ctx.session.user.id));
      
      return members.map(m => m.organization);
    }),

  /** Returns the active user's membership role in the current org — used to gate admin UI. */
  getMyMembership: protectedOrgProcedure.query(async ({ ctx }) => {
    return { role: ctx.memberRole };
  }),

  getMembers: protectedOrgProcedure
    .query(async ({ ctx }) => {
      const members = await db.select({
        id: member.id,
        role: member.role,
        createdAt: member.createdAt,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        }
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, ctx.orgId));
      
      return members;
    }),

  invite: protectedOrgProcedure
    .input(z.object({ email: z.string().email(), role: z.enum(["admin", "member", "owner"]) }))
    .mutation(async ({ input, ctx }) => {
      throw new TRPCError({ code: 'NOT_IMPLEMENTED' });
    }),

  createInviteLink: protectedOrgProcedure
    .mutation(async ({ ctx }) => {
      if (ctx.memberRole !== "owner" && ctx.memberRole !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await db.insert(inviteLinks).values({
        token,
        organizationId: ctx.orgId,
        expiresAt: expiresAt.toISOString(),
        createdBy: ctx.session.user.id,
      });

      return { token };
    }),

  ensureSettings: protectedProcedure
    .query(async ({ ctx }) => {
      const activeOrgId = ctx.session?.session?.activeOrganizationId;
      if (!activeOrgId) return { success: false };
      await db.insert(workspaceSettings).values({
        organizationId: activeOrgId,
        portalSlug: activeOrgId,
        plan: "FREE",
      }).onConflictDoNothing({ target: workspaceSettings.organizationId });
      return { success: true };
    }),

  getSettings: protectedOrgProcedure
    .query(async ({ ctx }) => {
      const [settings] = await db.select().from(workspaceSettings).where(eq(workspaceSettings.organizationId, ctx.orgId));
      if (!settings) throw new TRPCError({ code: "NOT_FOUND" });
      return settings;
    }),

  updateSettings: protectedOrgProcedure
    .input(z.object({ productDescription: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      await db.update(workspaceSettings)
        .set(input)
        .where(eq(workspaceSettings.organizationId, ctx.orgId));
      return { success: true };
    }),

  getSetupState: protectedOrgProcedure.query(async ({ ctx }) => {
    const orgId = ctx.orgId;
    
    const [settings] = await db.select().from(workspaceSettings).where(eq(workspaceSettings.organizationId, orgId));
  
    const [featureRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(featureRequests)
      .where(eq(featureRequests.organizationId, orgId));
  
    const [repoRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(repositories)
      .where(eq(repositories.organizationId, orgId));
  
    const [memberRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(member)
      .where(eq(member.organizationId, orgId));
  
    const [pendingInviteRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invitation)
      .where(
        and(
          eq(invitation.organizationId, orgId),
          eq(invitation.status, "pending"),
        ),
      );
  
    const featureCount = featureRow?.count ?? 0;
    const repoCount = repoRow?.count ?? 0;
    const memberCount = memberRow?.count ?? 0;
    const pendingInvites = pendingInviteRow?.count ?? 0;
  
    const steps = {
      workspace: true, // reaching here means an active org exists
      firstRequest: featureCount > 0,
      connectGithub: repoCount > 0,
      inviteTeam: memberCount > 1 || pendingInvites > 0,
    };
  
    const completed = Object.values(steps).filter(Boolean).length;
  
    return {
      steps,
      completed,
      total: 4,
      isComplete: completed === 4,
      plan: settings?.plan || "FREE",
      aiCreditsLimit: settings?.aiCreditsLimit || 500,
      aiCreditsUsed: settings?.aiCreditsUsed || 0,
      repoLimit: settings?.repoLimit || 3,
      memberLimit: settings?.memberLimit || 10,
      githubAppConnected: !!settings?.githubInstallationId,
    };
  }),
});
