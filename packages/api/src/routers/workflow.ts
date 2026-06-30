import { z } from "zod";
import { router, publicProcedure, protectedOrgProcedure } from "../trpc";
import { db, workflowSteps, webhookLogs, repositories, pullRequests } from "@claire/db";
import { TRPCError } from "@trpc/server";
import { eq, and, desc } from "drizzle-orm";
import { inngest } from "@claire/jobs";
import { upsertPullRequestFromWebhook } from "../lib/pr-ingest";

export const workflowRouter = router({
  getSteps: publicProcedure
    .input(z.object({ entityType: z.string(), entityId: z.string() }))
    .query(async ({ input }) => {
      return db
        .select()
        .from(workflowSteps)
        .where(
          and(
            eq(workflowSteps.entityType, input.entityType),
            eq(workflowSteps.entityId, input.entityId),
          ),
        )
        .orderBy(desc(workflowSteps.createdAt));
    }),

  /**
   * Lists recent valid pull_request webhook logs scoped to the active org.
   * Filters by source="github", event="pull_request", signatureValid=true,
   * then post-filters by githubId + installationId matching org's repositories.
   */
  listWebhookLogs: protectedOrgProcedure.query(async ({ ctx }) => {
    // Get all valid githubId + installationId pairs for this org
    const orgRepos = await db
      .select({ githubId: repositories.githubId, installationId: repositories.installationId })
      .from(repositories)
      .where(eq(repositories.organizationId, ctx.orgId));

    if (orgRepos.length === 0) return [];

    // Build a fast lookup set keyed by "githubId:installationId"
    const validPairs = new Set(
      orgRepos
        .filter((r) => r.githubId != null && r.installationId != null)
        .map((r) => `${r.githubId}:${r.installationId}`),
    );

    const logs = await db
      .select()
      .from(webhookLogs)
      .where(
        and(
          eq(webhookLogs.source, "github"),
          eq(webhookLogs.event, "pull_request"),
          eq(webhookLogs.signatureValid, true),
        ),
      )
      .orderBy(desc(webhookLogs.createdAt))
      .limit(50);

    // Post-filter: only logs whose payload repo belongs to this org (githubId + installationId both)
    return logs.filter((log) => {
      const gid = (log.payload as any)?.repository?.id;
      const iid = (log.payload as any)?.installation?.id;
      return gid != null && iid != null && validPairs.has(`${gid}:${iid}`);
    });
  }),

  /**
   * Admin-only: Re-fires a stored webhook payload through the Inngest review pipeline.
   * Identical ingestion path to the live webhook route via shared upsertPullRequestFromWebhook.
   */
  replayWebhook: protectedOrgProcedure
    .input(z.object({ webhookLogId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      // 1. Admin-only guard — checked against org membership role, same source as ctx
      if (ctx.memberRole !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
      }

      // 2. Fetch and validate log
      const [log] = await db
        .select()
        .from(webhookLogs)
        .where(eq(webhookLogs.id, input.webhookLogId));

      if (!log || !log.signatureValid || log.event !== "pull_request") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or unsupported webhook log" });
      }

      // 3. Action guard — only actionable PR events
      const action = (log.payload as any)?.action as string;
      if (!["opened", "synchronize", "reopened"].includes(action)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Unsupported action for replay: ${action}` });
      }

      // 4. Upsert PR via shared helper — enforces ctx.orgId match
      const result = await upsertPullRequestFromWebhook(log.payload, ctx.orgId);
      if (!result) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Repository not connected to your organization",
        });
      }

      // 5. Fire Inngest event
      const eventName =
        action === "opened" ? "github/pr.opened" : "github/pr.synchronize";

      await inngest.send({
        name: eventName,
        data: {
          repositoryId: result.repositoryId,
          pullRequestId: result.pullRequestId,
          organizationId: result.organizationId,
          githubPrNumber: result.githubPrNumber,
          installationId: result.installationId,
        },
      });

      return { success: true, action, pullRequestId: result.pullRequestId };
    }),
});
