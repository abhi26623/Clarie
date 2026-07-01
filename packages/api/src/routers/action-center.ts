import { router, protectedOrgProcedure } from "../trpc";
import { db, featureRequests } from "@claire/db";
import { eq, and, desc, count } from "drizzle-orm";

export const actionCenterRouter = router({
  summary: protectedOrgProcedure.query(async ({ ctx }) => {
    const isPrivileged =
      ctx.memberRole === "admin" || ctx.memberRole === "owner";

    // ── True counts for badge (no limit) ──────────────────────────
    const [clarificationsCount, needsFixesCount, approvalsPendingCount] =
      await Promise.all([
        db
          .select({ value: count() })
          .from(featureRequests)
          .where(
            and(
              eq(featureRequests.organizationId, ctx.orgId),
              eq(featureRequests.status, "clarification_needed"),
            ),
          )
          .then((r) => r[0]?.value ?? 0),

        db
          .select({ value: count() })
          .from(featureRequests)
          .where(
            and(
              eq(featureRequests.organizationId, ctx.orgId),
              eq(featureRequests.status, "fix_needed"),
            ),
          )
          .then((r) => r[0]?.value ?? 0),

        isPrivileged
          ? db
              .select({ value: count() })
              .from(featureRequests)
              .where(
                and(
                  eq(featureRequests.organizationId, ctx.orgId),
                  eq(featureRequests.status, "ready_for_approval"),
                ),
              )
              .then((r) => r[0]?.value ?? 0)
          : Promise.resolve(0),
      ]);

    // ── Top-5 item rows for the dropdown list ─────────────────────
    const itemCols = {
      id: featureRequests.id,
      title: featureRequests.title,
      status: featureRequests.status,
    } as const;

    const [clarifications, needsFixes, approvalsPending] = await Promise.all([
      db
        .select(itemCols)
        .from(featureRequests)
        .where(
          and(
            eq(featureRequests.organizationId, ctx.orgId),
            eq(featureRequests.status, "clarification_needed"),
          ),
        )
        .orderBy(desc(featureRequests.updatedAt))
        .limit(5),

      db
        .select(itemCols)
        .from(featureRequests)
        .where(
          and(
            eq(featureRequests.organizationId, ctx.orgId),
            eq(featureRequests.status, "fix_needed"),
          ),
        )
        .orderBy(desc(featureRequests.updatedAt))
        .limit(5),

      isPrivileged
        ? db
            .select(itemCols)
            .from(featureRequests)
            .where(
              and(
                eq(featureRequests.organizationId, ctx.orgId),
                eq(featureRequests.status, "ready_for_approval"),
              ),
            )
            .orderBy(desc(featureRequests.updatedAt))
            .limit(5)
        : Promise.resolve([]),
    ]);

    return {
      // True counts — used for the badge total
      counts: {
        clarifications: clarificationsCount,
        needsFixes: needsFixesCount,
        approvalsPending: approvalsPendingCount,
      },
      // Top-5 items — used for the dropdown rows
      items: {
        clarifications,
        needsFixes,
        approvalsPending,
      },
    };
  }),
});
