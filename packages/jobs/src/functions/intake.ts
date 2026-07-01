import { z } from "zod";
import { eq, and, notInArray } from "drizzle-orm";
import { db, featureRequests, prds, workflowSteps, AI_CREDIT_COSTS, consumeAiCredits, CreditsExhaustedError, CREDITS_EXHAUSTED_SENTINEL } from "@claire/db";
import { generateObjectResilient } from "@claire/ai";
import { inngest } from "../client";
import { runWorkflow, writeStep } from "../run-workflow";

export const POST_TRIAGE_PHASES = [
  "prd_ready", "tasks_generating", "tasks_ready",
  "in_development", "in_review", "fix_needed", "ready_for_approval", "shipped"
] as const;

export async function reconcileIntakeFailure(id: number) {
  // Check if a PRD was successfully generated despite the cancellation/failure
  const existingPrd = await db.query.prds.findFirst({
    where: (prds, { eq }) => eq(prds.featureRequestId, id)
  });

  const finalStatus = existingPrd ? "prd_ready" : "failed";

  await db.update(featureRequests)
    .set({ status: finalStatus })
    .where(eq(featureRequests.id, id));

  // Flip any orphaned running steps to failed
  await db.update(workflowSteps)
    .set({ status: "failed" })
    .where(and(
      eq(workflowSteps.entityType, "feature_request"),
      eq(workflowSteps.entityId, String(id)),
      eq(workflowSteps.status, "running")
    ));
}

const prdSchema = z.object({
  problemStatement: z.string().describe("2-3 concise sentences explaining the core problem."),
  goals: z.array(z.string().describe("One concise sentence per goal.")),
  nonGoals: z.array(z.string().describe("One concise sentence per non-goal.")),
  userStories: z.array(z.string().describe("One concise sentence per user story.")),
  acceptanceCriteria: z.array(z.object({ id: z.string(), text: z.string().describe("One concise sentence per criterion.") })),
  edgeCases: z.array(z.string().describe("One concise sentence per edge case.")),
  successMetrics: z.array(z.string().describe("One concise sentence per metric.")),
});

export const generatePrdWorkflow = inngest.createFunction(
  {
    id: "generate-prd-workflow",
    retries: 0,
    timeouts: { finish: "3m" },
    onFailure: async ({ event }) => {
      // Reconcile on failure
      const reqId = event.data.event.data.featureRequestId as number;
      await reconcileIntakeFailure(reqId);
    }
  },
  { event: "feature/prd.generate" },
  async ({ event, step }) => {
    const id = event.data.featureRequestId as number;
    const ctx = { entityType: "feature_request", entityId: String(id) };

    try {
      await runWorkflow(ctx, async () => {
        const [req] = await db.select().from(featureRequests).where(eq(featureRequests.id, id));
        if (!req) throw new Error(`Feature request ${id} not found`);

        const prd = await step.run("generate-prd", async () => {
          return await generateObjectResilient({
            schema: prdSchema,
            system: "You are a senior product manager. Write a thorough PRD from the feature request below. Generate acceptanceCriteria as an array of objects with a short unique slug id (e.g. 'auth-redirect', 'rate-limit-header') and a text field. Never use bare numbers as ids.",
            prompt: `Feature: "${req.title}"\nDetails: "${req.body}"\nAI reasoning: "${req.aiReasoning || "Approved for PRD generation"}"\n\nGenerate a complete PRD. Generate 3-5 goals, 3-6 acceptance criteria, and 2-4 edge cases to keep the PRD rich but focused.`,
            modelPurpose: "light",
            maxAttempts: 1,
            timeoutMs: 55_000,
          });
        });

        await step.run("save-prd", async () => {
          await db.transaction(async (tx) => {
            await tx.insert(prds).values({
              featureRequestId: id,
              problemStatement: prd.problemStatement,
              goals: prd.goals,
              nonGoals: prd.nonGoals,
              userStories: prd.userStories,
              acceptanceCriteria: prd.acceptanceCriteria,
              edgeCases: prd.edgeCases,
              successMetrics: prd.successMetrics,
            });

            await tx.update(featureRequests)
              .set({ status: "prd_ready" })
              .where(and(eq(featureRequests.id, id), notInArray(featureRequests.status, [...POST_TRIAGE_PHASES] as any)));
          });
        });

        // Consume prd-gen credit AFTER successful PRD generation.
        const prdCredit = await step.run("consume-prd", async () => {
          try {
            await consumeAiCredits(req.organizationId, AI_CREDIT_COSTS.prdGeneration);
            return { ok: true } as { ok: boolean, msg?: string };
          } catch (err: any) {
            if (err instanceof CreditsExhaustedError) return { ok: false, msg: err.message };
            throw err;
          }
        });

        if (!prdCredit.ok) {
          await db.update(featureRequests)
            .set({ status: "failed", aiReasoning: `${CREDITS_EXHAUSTED_SENTINEL}${prdCredit.msg}` })
            .where(eq(featureRequests.id, id));
          await writeStep(ctx, "failed", "failed", { label: "Credits exhausted" });
          return;
        }

        await writeStep(ctx, "prd", "done", { label: "PRD ready for review" });
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const safeMsg = errMsg.length > 0 && errMsg.length < 500
        ? errMsg
        : "The PRD generation workflow encountered an unexpected error.";
      await db.update(featureRequests)
        .set({ status: "failed", aiReasoning: safeMsg })
        .where(eq(featureRequests.id, id))
        .catch(() => {});
      
      throw err;
    }
  },
);

export const generatePrdWorkflowCancel = inngest.createFunction(
  { id: "feature-intake-cancel-handler", retries: 0 },
  { event: "inngest/function.cancelled" },
  async ({ event }) => {
    if (event.data.function_id === "generate-prd-workflow" || event.data.function_id === "feature-clarification-answered") {
      const originalEvent = event.data.event as any;
      if (originalEvent?.data?.featureRequestId) {
        await reconcileIntakeFailure(originalEvent.data.featureRequestId);
      }
    }
  }
);
