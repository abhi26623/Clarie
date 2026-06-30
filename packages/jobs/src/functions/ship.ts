import { eq } from "drizzle-orm";
import { db, featureRequests } from "@claire/db";
import { inngest } from "../client";
import { runWorkflow, writeStep } from "../run-workflow";

export const featureShippedWorkflow = inngest.createFunction(
  { id: "feature-shipped" },
  { event: "feature/shipped" },
  async ({ event }) => {
    const id = event.data.featureRequestId as number;
    const ctx = { entityType: "feature_request", entityId: String(id) };

    await runWorkflow(ctx, async () => {
      const [req] = await db.select().from(featureRequests).where(eq(featureRequests.id, id));
      if (!req) throw new Error(`Feature request ${id} not found`);

      // Compute timeToShipDays from createdAt to now
      const createdAt = req.createdAt ? new Date(req.createdAt).getTime() : Date.now();
      const timeToShipDays = Math.round((Date.now() - createdAt) / (1000 * 60 * 60 * 24));

      await db.update(featureRequests)
        .set({ status: "shipped", timeToShipDays })
        .where(eq(featureRequests.id, id));

      await writeStep(ctx, "shipped", "done", {
        label: "Feature shipped 🎉",
        timeToShipDays,
      });
    });
  },
);
