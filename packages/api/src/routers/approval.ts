import { z } from "zod";
import { router, protectedOrgProcedure } from "../trpc";
import { db, featureRequests, approvals, aiReviews, member } from "@claire/db";
import { TRPCError } from "@trpc/server";
import { eq, and, desc } from "drizzle-orm";
import { inngest } from "@claire/jobs";

async function assertFeatureOrg(featureId: number, orgId: string) {
  const [feature] = await db.select().from(featureRequests).where(and(eq(featureRequests.id, featureId), eq(featureRequests.organizationId, orgId)));
  if (!feature) throw new TRPCError({ code: "NOT_FOUND", message: "Feature not found" });
  return feature;
}

async function assertAdminRole(userId: string, orgId: string) {
  const [m] = await db.select().from(member).where(and(eq(member.userId, userId), eq(member.organizationId, orgId)));
  if (!m || (m.role !== "admin" && m.role !== "owner")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin or owner role required for this action" });
  }
}

export const approvalRouter = router({
  listPending: protectedOrgProcedure.query(async ({ ctx }) => {
    await assertAdminRole(ctx.session.user.id, ctx.orgId);
    return db.query.featureRequests.findMany({
      where: and(
        eq(featureRequests.organizationId, ctx.orgId),
        eq(featureRequests.status, "ready_for_approval")
      ),
      with: {
        aiReviews: { with: { issues: true }, orderBy: desc(aiReviews.reviewNumber) },
      },
      orderBy: desc(featureRequests.createdAt),
    });
  }),

  getContext: protectedOrgProcedure
    .input(z.object({ featureId: z.number() }))
    .query(async ({ input, ctx }) => {
      await assertAdminRole(ctx.session.user.id, ctx.orgId);
      const result = await db.query.featureRequests.findFirst({
        where: and(
          eq(featureRequests.id, input.featureId),
          eq(featureRequests.organizationId, ctx.orgId)
        ),
        with: {
          prd: true,
          tasks: true,
          aiReviews: { with: { issues: true }, orderBy: desc(aiReviews.reviewNumber) },
        }
      });
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Feature not found in this workspace" });
      return result;
    }),

  submit: protectedOrgProcedure
    .input(z.object({
      featureId: z.number(),
      decision: z.enum(["approved", "rejected", "needs_changes"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await assertAdminRole(ctx.session.user.id, ctx.orgId);
      await assertFeatureOrg(input.featureId, ctx.orgId);

      if (input.decision === "needs_changes" && (!input.notes || input.notes.trim() === "")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Notes are required when sending back for fixes" });
      }

      const [approval] = await db.insert(approvals).values({
        featureRequestId: input.featureId,
        reviewerId: ctx.session.user.id,
        decision: input.decision,
        notes: input.notes,
      }).returning();
      
      if (input.decision === "needs_changes") {
        await db.update(featureRequests)
          .set({ status: "fix_needed", updatedAt: new Date().toISOString() })
          .where(eq(featureRequests.id, input.featureId));
      } else if (input.decision === "rejected") {
        await db.update(featureRequests)
          .set({ status: "rejected", updatedAt: new Date().toISOString() })
          .where(eq(featureRequests.id, input.featureId));
      }
      
      return approval;
    }),

  ship: protectedOrgProcedure
    .input(z.object({
      featureId: z.number(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // 1. Assert admin/owner role
      await assertAdminRole(ctx.session.user.id, ctx.orgId);

      // Perform atomic approval + ship in a single database transaction
      const shippedFeature = await db.transaction(async (tx) => {
        // 2. Verify feature exists in this workspace and is in ready_for_approval state
        const [feature] = await tx.select().from(featureRequests).where(
          and(
            eq(featureRequests.id, input.featureId),
            eq(featureRequests.organizationId, ctx.orgId)
          )
        );

        if (!feature) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Feature not found" });
        }

        if (feature.status !== "ready_for_approval") {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Feature is not in ready_for_approval state (current status: ${feature.status})`,
          });
        }

        // 3. Write the approval row
        await tx.insert(approvals).values({
          featureRequestId: input.featureId,
          reviewerId: ctx.session.user.id,
          decision: "approved",
          notes: input.notes,
        });

        // 4. Compute timeToShipDays synchronously and set status to shipped
        const now = new Date();
        const createdDate = feature.createdAt ? new Date(feature.createdAt) : now;
        const diffTime = Math.abs(now.getTime() - createdDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const timeToShipDays = diffDays > 0 ? diffDays : 1;

        const [updatedFeature] = await tx.update(featureRequests)
          .set({
            status: "shipped",
            timeToShipDays,
            updatedAt: now.toISOString(),
          })
          .where(eq(featureRequests.id, input.featureId))
          .returning();

        return updatedFeature;
      });

      // 5. Fire Inngest event after commit for side effects only (notifications, webhook triggers)
      await inngest.send({
        name: "feature/shipped",
        data: { featureRequestId: input.featureId, organizationId: ctx.orgId },
      });

      return shippedFeature;
    }),

  listByFeature: protectedOrgProcedure
    .input(z.object({ featureId: z.number() }))
    .query(async ({ input, ctx }) => {
      await assertFeatureOrg(input.featureId, ctx.orgId);
      return db.query.approvals.findMany({
        where: eq(approvals.featureRequestId, input.featureId),
        with: {
          reviewer: true,
        },
        orderBy: desc(approvals.createdAt),
      });
    }),
});

