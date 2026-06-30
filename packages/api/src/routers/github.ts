import { z } from "zod";
import { router, protectedOrgProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { db, repositories, pullRequests, featureRequests, workspaceSettings } from "@claire/db";
import { eq, and, desc } from "drizzle-orm";
import { env } from "@claire/config/env";
import crypto from "node:crypto";
import { getInstallationOctokit, listRepos as listGithubRepos } from "../lib/github";

export const githubRouter = router({
  getInstallUrl: protectedOrgProcedure
    .query(async ({ ctx }) => {
      // Create a signed state bound to ctx.orgId, current user id, and timestamp
      const payload = `${ctx.orgId}:${ctx.session.user.id}:${Date.now()}`;
      const hmac = crypto.createHmac("sha256", env.BETTER_AUTH_SECRET).update(payload).digest("hex");
      const state = encodeURIComponent(`${payload}.${hmac}`);
      const baseUrl = env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL || `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`;
      return { url: `${baseUrl}?state=${state}` };
    }),

  completeInstallation: protectedOrgProcedure
    .input(z.object({ installationId: z.number(), state: z.string() }))
    .query(async ({ input, ctx }) => {
      const decoded = decodeURIComponent(input.state);
      const parts = decoded.split(".");
      if (parts.length !== 2) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Malformed state parameter" });
      }
      const [payload, signature] = parts;
      const expectedSignature = crypto.createHmac("sha256", env.BETTER_AUTH_SECRET).update(payload).digest("hex");
      if (signature !== expectedSignature) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid state signature" });
      }
      const [orgId, , timestampStr] = payload.split(":");
      if (orgId !== ctx.orgId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "State does not belong to the active organization" });
      }
      const timestamp = parseInt(timestampStr, 10);
      if (Date.now() - timestamp > 1000 * 60 * 60) { // 1 hour expiry
        throw new TRPCError({ code: "BAD_REQUEST", message: "State has expired" });
      }

      // Persist installationId to workspace_settings (upsert-safe: update only, row always exists post-onboarding)
      await db
        .update(workspaceSettings)
        .set({ githubInstallationId: input.installationId })
        .where(eq(workspaceSettings.organizationId, ctx.orgId));

      // Fetch and return available repos from GitHub
      const available = await listGithubRepos(input.installationId);
      return available;
    }),

  getInstallationStatus: protectedOrgProcedure
    .query(async ({ ctx }) => {
      const settings = await db.query.workspaceSettings.findFirst({
        where: eq(workspaceSettings.organizationId, ctx.orgId),
      });
      const installationId = settings?.githubInstallationId ?? null;
      return {
        installationId,
        canListRepos: installationId !== null,
      };
    }),

  listRepos: protectedOrgProcedure
    .query(async ({ ctx }) => {
      // Always read installationId from workspace_settings — never trust client-passed values
      const settings = await db.query.workspaceSettings.findFirst({
        where: eq(workspaceSettings.organizationId, ctx.orgId),
      });
      const installationId = settings?.githubInstallationId ?? null;

      const connected = await db.select().from(repositories)
        .where(eq(repositories.organizationId, ctx.orgId))
        .orderBy(desc(repositories.createdAt));

      if (!installationId) {
        return { connected, available: [] };
      }

      const available = await listGithubRepos(installationId);
      return { connected, available };
    }),

  connectRepo: protectedOrgProcedure
    .input(z.object({ repoId: z.number(), name: z.string(), fullName: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Always use the org's stored installationId — never trust client-passed values
      const settings = await db.query.workspaceSettings.findFirst({
        where: eq(workspaceSettings.organizationId, ctx.orgId),
      });
      if (!settings?.githubInstallationId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "GitHub App not installed for this organization" });
      }
      const installationId = settings.githubInstallationId;

      const [existing] = await db.select().from(repositories)
        .where(and(eq(repositories.organizationId, ctx.orgId), eq(repositories.fullName, input.fullName)));

      if (existing) {
        const [updated] = await db.update(repositories)
          .set({ githubId: input.repoId, installationId, webhookActive: true })
          .where(eq(repositories.id, existing.id))
          .returning();
        return updated;
      }

      const [created] = await db.insert(repositories).values({
        organizationId: ctx.orgId,
        githubId: input.repoId,
        installationId,
        fullName: input.fullName,
        name: input.name,
        webhookActive: true,
      }).returning();
      return created;
    }),

  disconnectRepo: protectedOrgProcedure
    .input(z.object({ repoId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const [deleted] = await db.delete(repositories)
        .where(and(eq(repositories.id, input.repoId), eq(repositories.organizationId, ctx.orgId)))
        .returning();
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Repository not found" });
      }
      return deleted;
    }),

  listPullRequests: protectedOrgProcedure
    .input(z.object({ repoId: z.number() }))
    .query(async ({ input, ctx }) => {
      const [repo] = await db.select().from(repositories)
        .where(and(eq(repositories.id, input.repoId), eq(repositories.organizationId, ctx.orgId)));
      if (!repo || !repo.installationId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Repository or installation not found" });
      }
      const [owner, repoName] = repo.fullName.split("/");
      const octokit = await getInstallationOctokit(repo.installationId);
      const { data } = await octokit.rest.pulls.list({
        owner,
        repo: repoName,
        state: "all",
        per_page: 50,
      });
      return data;
    }),

  getPullRequest: protectedOrgProcedure
    .input(z.object({ prId: z.number() }))
    .query(async ({ input, ctx }) => {
      const pr = await db.query.pullRequests.findFirst({
        where: eq(pullRequests.id, input.prId),
        with: {
          repository: true,
          files: true,
          featureRequest: true,
          aiReviews: { with: { issues: true } },
        },
      });
      if (!pr || pr.repository?.organizationId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pull request not found" });
      }
      return pr;
    }),

  linkPrToFeature: protectedOrgProcedure
    .input(z.object({ prId: z.number(), featureId: z.number().nullable() }))
    .mutation(async ({ input, ctx }) => {
      const pr = await db.query.pullRequests.findFirst({
        where: eq(pullRequests.id, input.prId),
        with: { repository: true },
      });
      if (!pr || pr.repository?.organizationId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pull request not found" });
      }
      if (input.featureId) {
        const [feat] = await db.select().from(featureRequests)
          .where(and(eq(featureRequests.id, input.featureId), eq(featureRequests.organizationId, ctx.orgId)));
        if (!feat) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Feature request not found" });
        }
      }
      const [updated] = await db.update(pullRequests)
        .set({ featureRequestId: input.featureId })
        .where(eq(pullRequests.id, input.prId))
        .returning();
      return updated;
    }),

  syncPullRequests: protectedOrgProcedure
    .input(z.object({ repoId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const [repo] = await db.select().from(repositories)
        .where(and(eq(repositories.id, input.repoId), eq(repositories.organizationId, ctx.orgId)));
      if (!repo || !repo.installationId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Repository or installation not found" });
      }
      const [owner, repoName] = repo.fullName.split("/");
      const octokit = await getInstallationOctokit(repo.installationId);
      const { data: prs } = await octokit.rest.pulls.list({
        owner,
        repo: repoName,
        state: "all",
        per_page: 50,
      });

      let syncedCount = 0;
      for (const pr of prs) {
        const state = pr.state === "open" ? "open" : pr.merged_at ? "merged" : "closed";

        let featureRequestId: number | null = null;
        if (pr.body) {
          const match = pr.body.match(/claire-request-(\d+)/);
          if (match && match[1]) {
            const possibleId = parseInt(match[1], 10);
            const [feat] = await db.select().from(featureRequests)
              .where(and(eq(featureRequests.id, possibleId), eq(featureRequests.organizationId, ctx.orgId)));
            if (feat) featureRequestId = feat.id;
          }
        }

        const [existing] = await db.select().from(pullRequests)
          .where(and(eq(pullRequests.repositoryId, repo.id), eq(pullRequests.githubPrNumber, pr.number)));

        if (existing) {
          await db.update(pullRequests)
            .set({
              title: pr.title,
              body: pr.body ?? "",
              state,
              lastCommitSha: pr.head.sha,
              ...(featureRequestId ? { featureRequestId } : {}),
            })
            .where(eq(pullRequests.id, existing.id));
        } else {
          await db.insert(pullRequests).values({
            repositoryId: repo.id,
            githubPrNumber: pr.number,
            title: pr.title,
            body: pr.body ?? "",
            state,
            authorLogin: pr.user?.login ?? "unknown",
            sourceBranch: pr.head.ref,
            targetBranch: pr.base.ref,
            githubUrl: pr.html_url,
            lastCommitSha: pr.head.sha,
            featureRequestId,
          });
        }
        syncedCount++;
      }

      return { success: true, syncedCount };
    }),
});
