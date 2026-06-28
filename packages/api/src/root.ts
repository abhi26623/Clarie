import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db, featureRequests, workflowSteps } from "@claire/db";
import { inngest } from "@claire/jobs";
import { router, publicProcedure, protectedProcedure } from "./trpc";

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true, ts: Date.now() })),

  // Public portal: submit a feature idea and kick off the live intake workflow.
  submitFeature: publicProcedure
    .input(z.object({
      organizationId: z.string(),
      title: z.string().min(3),
      body: z.string().min(3),
      submitterName: z.string().optional(),
      submitterEmail: z.string().email().optional(),
    }))
    .mutation(async ({ input }) => {
      const [created] = await db.insert(featureRequests).values({
        organizationId: input.organizationId,
        title: input.title, body: input.body,
        submitterName: input.submitterName, submitterEmail: input.submitterEmail,
        source: "portal", status: "received",
      }).returning();
      await inngest.send({ name: "feature/created", data: { featureRequestId: created.id } });
      return { id: created.id };
    }),

  // Live progress for the portal/detail UI (poll this).
  steps: publicProcedure
    .input(z.object({ entityType: z.string(), entityId: z.string() }))
    .query(async ({ input }) => {
      return db.select().from(workflowSteps)
        .where(eq(workflowSteps.entityType, input.entityType))
        .orderBy(desc(workflowSteps.createdAt));
    }),

  // Authenticated dashboard list.
  listRequests: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.session.session.activeOrganizationId;
    if (!orgId) return [];
    return db.select().from(featureRequests)
      .where(eq(featureRequests.organizationId, orgId))
      .orderBy(desc(featureRequests.createdAt));
  }),
});

export type AppRouter = typeof appRouter;
