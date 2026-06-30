import { z } from "zod";
import { router, protectedOrgProcedure } from "../trpc";
import { db, featureRequests, prds, member } from "@claire/db";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { inngest } from "@claire/jobs";

async function assertFeatureOrg(featureId: number, orgId: string) {
  const [feature] = await db.select().from(featureRequests).where(and(eq(featureRequests.id, featureId), eq(featureRequests.organizationId, orgId)));
  if (!feature) throw new TRPCError({ code: "NOT_FOUND", message: "Feature not found" });
}

async function assertFeatureOrgAdmin(featureId: number, orgId: string, userId?: string) {
  if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
  const [feature] = await db.select().from(featureRequests).where(and(eq(featureRequests.id, featureId), eq(featureRequests.organizationId, orgId)));
  if (!feature) throw new TRPCError({ code: "NOT_FOUND", message: "Feature not found" });

  const [m] = await db.select().from(member).where(and(eq(member.organizationId, orgId), eq(member.userId, userId)));
  if (!m || (m.role !== "admin" && m.role !== "owner")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only admins or owners can perform this action" });
  }
}

export const prdRouter = router({
  getByFeature: protectedOrgProcedure
    .input(z.object({ featureId: z.number() }))
    .query(async ({ input, ctx }) => {
      await assertFeatureOrg(input.featureId, ctx.orgId);
      const [prd] = await db.select().from(prds).where(eq(prds.featureRequestId, input.featureId));
      if (!prd) throw new TRPCError({ code: "NOT_FOUND" });
      return prd;
    }),

  approve: protectedOrgProcedure
    .input(z.object({ id: z.number(), featureId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await assertFeatureOrgAdmin(input.featureId, ctx.orgId, ctx.session?.user?.id);
      const [updated] = await db.update(prds).set({ approved: true }).where(eq(prds.id, input.id)).returning();
      
      await db.update(featureRequests).set({ status: "tasks_generating" }).where(eq(featureRequests.id, input.featureId));
      await inngest.send({ name: "prd/approved", data: { featureRequestId: input.featureId } });
      
      return updated;
    }),

  reject: protectedOrgProcedure
    .input(z.object({ id: z.number(), featureId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await assertFeatureOrgAdmin(input.featureId, ctx.orgId, ctx.session?.user?.id);
      const [updated] = await db.update(prds).set({ approved: false }).where(eq(prds.id, input.id)).returning();
      await db.update(featureRequests).set({ status: "rejected" }).where(eq(featureRequests.id, input.featureId));
      return updated;
    }),

  update: protectedOrgProcedure
    .input(z.object({
      id: z.number(),
      featureId: z.number(),
      problemStatement: z.string().optional(),
      goals: z.any().optional(),
      nonGoals: z.any().optional(),
      userStories: z.any().optional(),
      acceptanceCriteria: z.any().optional(),
      edgeCases: z.any().optional(),
      successMetrics: z.any().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await assertFeatureOrgAdmin(input.featureId, ctx.orgId, ctx.session?.user?.id);
      const { id, featureId, ...rest } = input;
      const [updated] = await db.update(prds).set(rest).where(eq(prds.id, id)).returning();
      return updated;
    }),
});
