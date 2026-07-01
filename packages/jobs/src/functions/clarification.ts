import { z } from "zod";
import { eq, and, notInArray } from "drizzle-orm";
import { db, featureRequests, clarificationThreads, prds, AI_CREDIT_COSTS, consumeAiCredits, CreditsExhaustedError, CREDITS_EXHAUSTED_SENTINEL } from "@claire/db";
import { generateObjectResilient } from "@claire/ai";
import { inngest } from "../client";
import { runWorkflow, writeStep } from "../run-workflow";
import { reconcileIntakeFailure, POST_TRIAGE_PHASES } from "./intake";

const prdSchema = z.object({
  problemStatement: z.string().describe("2-3 concise sentences explaining the core problem."),
  goals: z.array(z.string().describe("One concise sentence per goal.")),
  nonGoals: z.array(z.string().describe("One concise sentence per non-goal.")),
  userStories: z.array(z.string().describe("One concise sentence per user story.")),
  acceptanceCriteria: z.array(z.object({ id: z.string(), text: z.string().describe("One concise sentence per criterion.") })),
  edgeCases: z.array(z.string().describe("One concise sentence per edge case.")),
  successMetrics: z.array(z.string().describe("One concise sentence per metric.")),
});

export const clarificationAnsweredWorkflow = inngest.createFunction(
  { 
    id: "feature-clarification-answered", 
    idempotency: "event.data.clarificationThreadId",
    retries: 0,
    timeouts: { finish: "4m" },
    onFailure: async ({ event }) => {
      const reqId = event.data.event.data.featureRequestId as number;
      await reconcileIntakeFailure(reqId);
    }
  },
  { event: "feature/clarification.answered" },
  async ({ event, step }) => {
    const id = event.data.featureRequestId as number;
    const ctx = { entityType: "feature_request", entityId: String(id) };

    try {
      await runWorkflow(ctx, async () => {
        const [req] = await db.select().from(featureRequests).where(eq(featureRequests.id, id));
        if (!req) throw new Error(`Feature request ${id} not found`);

        // Load all clarification threads for context
        const threads = await db.select().from(clarificationThreads)
          .where(eq(clarificationThreads.featureRequestId, id));

        const answered = threads.filter(t => t.answer).sort((a, b) =>
          new Date(b.answeredAt ?? 0).getTime() - new Date(a.answeredAt ?? 0).getTime()
        )[0];

        if (!answered) throw new Error("No answered clarification thread found");

        // Set status → prd_generating immediately (skip re-triage entirely)
        await writeStep(ctx, "prd", "running", { label: "Generating product requirements" });
        await db.update(featureRequests)
          .set({ status: "prd_generating" })
          .where(and(eq(featureRequests.id, id), notInArray(featureRequests.status, [...POST_TRIAGE_PHASES] as any)));

        // Build Q&A context for the PRD prompt
        const clarificationContext = threads.map(t =>
          `Q: ${t.question}\nA: ${t.answer ?? "(unanswered)"}`
        ).join("\n\n");

        // Single LLM call: generate PRD directly with all context
        const prd = await step.run("generate-prd", async () => {
          return await generateObjectResilient({
            schema: prdSchema,
            system: "You are a senior product manager. Write a focused PRD from the feature request and clarification Q&A below. Generate acceptanceCriteria as an array of objects with a short unique slug id (e.g. 'auth-redirect', 'rate-limit-header') and a text field. Never use bare numbers as ids.",
            prompt: `Feature: "${req.title}"\nDetails: "${req.body}"\n\nClarification Q&A:\n${clarificationContext}\n\nGenerate a complete PRD. Generate 3-5 goals, 3-6 acceptance criteria, and 2-4 edge cases to keep the PRD rich but focused.`,
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

            // Atomic status flip with insert
            await tx.update(featureRequests)
              .set({ status: "prd_ready", aiDecision: "proceed", aiReasoning: "PRD generated from clarification context." })
              .where(eq(featureRequests.id, id));
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
        : "The clarification workflow encountered an unexpected error.";
      await db.update(featureRequests)
        .set({ status: "failed", aiReasoning: safeMsg })
        .where(eq(featureRequests.id, id))
        .catch(() => {});
      
      throw err;
    }
  },
);
