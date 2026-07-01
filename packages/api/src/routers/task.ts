import { z } from "zod";
import { router, protectedOrgProcedure } from "../trpc";
import { db, featureRequests, tasks, taskStatus } from "@claire/db";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";

async function assertFeatureOrg(featureId: number, orgId: string) {
  const [feature] = await db.select().from(featureRequests).where(and(eq(featureRequests.id, featureId), eq(featureRequests.organizationId, orgId)));
  if (!feature) throw new TRPCError({ code: "NOT_FOUND", message: "Feature not found" });
}

export const taskRouter = router({
  listByFeature: protectedOrgProcedure
    .input(z.object({ featureId: z.number() }))
    .query(async ({ input, ctx }) => {
      await assertFeatureOrg(input.featureId, ctx.orgId);
      return db.select().from(tasks).where(eq(tasks.featureRequestId, input.featureId));
    }),

  updateStatus: protectedOrgProcedure
    .input(z.object({ id: z.number(), featureId: z.number(), status: z.enum(taskStatus.enumValues) }))
    .mutation(async ({ input, ctx }) => {
      await assertFeatureOrg(input.featureId, ctx.orgId);
      const [updated] = await db.update(tasks).set({ status: input.status }).where(and(eq(tasks.id, input.id), eq(tasks.featureRequestId, input.featureId))).returning();
      return updated;
    }),

  updateOrder: protectedOrgProcedure
    .input(z.object({ id: z.number(), featureId: z.number(), order: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await assertFeatureOrg(input.featureId, ctx.orgId);
      const [updated] = await db.update(tasks).set({ order: input.order }).where(and(eq(tasks.id, input.id), eq(tasks.featureRequestId, input.featureId))).returning();
      return updated;
    }),

  assign: protectedOrgProcedure
    .input(z.object({ id: z.number(), featureId: z.number(), assigneeId: z.string().nullable(), assignedToAI: z.boolean().optional() }))
    .mutation(async ({ input, ctx }) => {
      await assertFeatureOrg(input.featureId, ctx.orgId);
      const [updated] = await db.update(tasks).set({ assigneeId: input.assigneeId, assignedToAI: input.assignedToAI }).where(and(eq(tasks.id, input.id), eq(tasks.featureRequestId, input.featureId))).returning();
      return updated;
    }),

  update: protectedOrgProcedure
    .input(z.object({ id: z.number(), featureId: z.number(), title: z.string().optional(), description: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      await assertFeatureOrg(input.featureId, ctx.orgId);
      const { id, featureId, ...rest } = input;
      const [updated] = await db.update(tasks).set(rest).where(and(eq(tasks.id, id), eq(tasks.featureRequestId, featureId))).returning();
      return updated;
    }),
});
