import { z } from "zod";
import { router, protectedOrgProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  db, featureRequests, aiReviews, pullRequests, repositories, reviewIssues,
} from "@claire/db";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { inngest } from "@claire/jobs";

export const reviewRouter = router({
  /** All AI reviews for the active org — SQL-level tenant isolation, no in-memory filtering */
  listAll: protectedOrgProcedure.query(async ({ ctx }) => {
    const orgRepoIds = db
      .select({ id: repositories.id })
      .from(repositories)
      .where(eq(repositories.organizationId, ctx.orgId));

    const orgPrIds = db
      .select({ id: pullRequests.id })
      .from(pullRequests)
      .where(inArray(pullRequests.repositoryId, orgRepoIds));

    return db.query.aiReviews.findMany({
      where: inArray(aiReviews.pullRequestId, orgPrIds),
      with: {
        issues: true,
        pullRequest: { with: { repository: true } },
      },
      orderBy: [desc(aiReviews.createdAt)],
    });
  }),

  /** Single review with all history for the same PR — org-guarded before returning anything */
  getById: protectedOrgProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const review = await db.query.aiReviews.findFirst({
        where: eq(aiReviews.id, input.id),
        with: {
          issues: true,
          pullRequest: { with: { repository: true } },
          featureRequest: true,
        },
      });

      // Strict org guard — check before returning review or history
      if (!review || review.pullRequest?.repository?.organizationId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Review not found" });
      }

      // History for the same PR, issues included so timeline can show count reductions
      const history = await db.query.aiReviews.findMany({
        where: eq(aiReviews.pullRequestId, review.pullRequestId),
        with: { issues: true },
        orderBy: [asc(aiReviews.reviewNumber)],
      });

      return { ...review, history };
    }),

  /** Manually trigger a review re-run for a PR the org owns */
  triggerReview: protectedOrgProcedure
    .input(z.object({ pullRequestId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const pr = await db.query.pullRequests.findFirst({
        where: eq(pullRequests.id, input.pullRequestId),
        with: { repository: true },
      });
      if (!pr || pr.repository?.organizationId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pull request not found" });
      }
      if (!pr.repository.installationId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "GitHub App not installed for this repository" });
      }

      await inngest.send({
        name: "github/pr.synchronize",
        data: {
          repositoryId: pr.repositoryId,
          pullRequestId: pr.id,
          organizationId: pr.repository.organizationId,
          githubPrNumber: pr.githubPrNumber,
          installationId: pr.repository.installationId,
        },
      });
      return { success: true };
    }),

  /** Mark a review issue as resolved */
  resolveIssue: protectedOrgProcedure
    .input(z.object({ issueId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const issue = await db.query.reviewIssues.findFirst({
        where: eq(reviewIssues.id, input.issueId),
        with: { review: { with: { pullRequest: { with: { repository: true } } } } },
      });
      if (!issue || issue.review?.pullRequest?.repository?.organizationId !== ctx.orgId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Issue not found" });
      }

      const [updated] = await db
        .update(reviewIssues)
        .set({ resolved: true })
        .where(eq(reviewIssues.id, input.issueId))
        .returning();
      return updated;
    }),
});
