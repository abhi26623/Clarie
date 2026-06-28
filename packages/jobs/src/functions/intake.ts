import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, featureRequests, clarificationThreads } from "@claire/db";
import { generateObjectResilient } from "@claire/ai";
import { inngest } from "../client";
import { runWorkflow, writeStep } from "../run-workflow";

const decisionSchema = z.object({
  decision: z.enum(["proceed", "duplicate", "feature_exists", "clarification_needed", "bug_report", "out_of_scope"]),
  reasoning: z.string(),
  clarification: z.object({ question: z.string(), options: z.array(z.string()).max(4) }).optional(),
});

export const intakeWorkflow = inngest.createFunction(
  { id: "feature-intake" },
  { event: "feature/created" },
  async ({ event }) => {
    const id = event.data.featureRequestId as number;
    const ctx = { entityType: "feature_request", entityId: String(id) };

    await runWorkflow(ctx, async () => {
      await writeStep(ctx, "receive", "done", { label: "Got your request" });

      const [req] = await db.select().from(featureRequests).where(eq(featureRequests.id, id));
      if (!req) throw new Error("Feature request not found");

      await writeStep(ctx, "analyze", "running", { label: "Reading your idea" });
      await db.update(featureRequests).set({ status: "analyzing" }).where(eq(featureRequests.id, id));

      const result = await generateObjectResilient({
        schema: decisionSchema,
        system: "You triage product feature requests. Ask at most one clarifying question, prefer multiple choice. Never depend on source code.",
        prompt: `Feature request title: ${req.title}\nDetails: ${req.body}\nDecide how to handle it.`,
      });

      await writeStep(ctx, "decide", "done", { label: "Decision ready", decision: result.decision });

      const statusMap = {
        proceed: "accepted", duplicate: "duplicate", feature_exists: "feature_exists",
        clarification_needed: "clarification_needed", bug_report: "bug_report", out_of_scope: "out_of_scope",
      } as const;

      await db.update(featureRequests)
        .set({ status: statusMap[result.decision], aiDecision: result.decision, aiReasoning: result.reasoning })
        .where(eq(featureRequests.id, id));

      if (result.decision === "clarification_needed" && result.clarification) {
        await db.insert(clarificationThreads).values({
          featureRequestId: id,
          question: result.clarification.question,
          options: result.clarification.options,
        });
      }
    });
  },
);
