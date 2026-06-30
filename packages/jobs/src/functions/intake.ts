import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, featureRequests, clarificationThreads, prds } from "@claire/db";
import { generateObjectResilient } from "@claire/ai";
import { inngest } from "../client";
import { runWorkflow, writeStep } from "../run-workflow";

// Zod schema — all lowercase snake_case to match DB enum and branching below
const decisionSchema = z.object({
  decision: z.enum(["proceed", "duplicate", "feature_exists", "clarification_needed", "bug_report", "out_of_scope"]),
  reasoning: z.string(),
  clarification: z.object({
    question: z.string(),
    questionType: z.enum(["TEXT", "CHOICE", "YESNO"]).default("TEXT"),
    options: z.array(z.string()).max(4).optional(),
  }).optional(),
});

const prdSchema = z.object({
  problemStatement: z.string(),
  goals: z.array(z.string()),
  nonGoals: z.array(z.string()),
  userStories: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
  edgeCases: z.array(z.string()),
  successMetrics: z.array(z.string()),
});

export const intakeWorkflow = inngest.createFunction(
  { id: "feature-intake", retries: 2 },
  { event: "feature/intake" },
  async ({ event }) => {
    const id = event.data.featureRequestId as number;
    const ctx = { entityType: "feature_request", entityId: String(id) };

    try {
      await runWorkflow(ctx, async () => {
      const [req] = await db.select().from(featureRequests).where(eq(featureRequests.id, id));
      if (!req) throw new Error(`Feature request ${id} not found`);

      await writeStep(ctx, "analyze", "running", { label: "Analyzing your request" });
      await db.update(featureRequests).set({ status: "analyzing" }).where(eq(featureRequests.id, id));

      const result = await generateObjectResilient({
        schema: decisionSchema,
        system: "You are a senior product manager triaging feature requests. Classify the request precisely. Ask at most one clarifying question (prefer multiple choice). Never reference source code.",
        prompt: `Feature request title: "${req.title}"\nDetails: "${req.body}"\n\nClassify and decide how to handle it.`,
        modelPurpose: "light",
      });

      // All status writes use real featureStatus enum values
      if (result.decision === "clarification_needed" && result.clarification) {
        await db.insert(clarificationThreads).values({
          featureRequestId: id,
          question: result.clarification.question,
          questionType: result.clarification.questionType ?? "TEXT",
          options: result.clarification.options ?? null,
        });
        await db.update(featureRequests)
          .set({ status: "clarification_needed", aiDecision: result.decision, aiReasoning: result.reasoning })
          .where(eq(featureRequests.id, id));
        await writeStep(ctx, "clarification", "done", { label: "Clarification needed", question: result.clarification.question });
        return;
      }

      if (result.decision === "duplicate") {
        await db.update(featureRequests)
          .set({ status: "duplicate", aiDecision: result.decision, aiReasoning: result.reasoning })
          .where(eq(featureRequests.id, id));
        await writeStep(ctx, "classified", "done", { label: "Duplicate request", reasoning: result.reasoning });
        return;
      }

      if (result.decision === "feature_exists") {
        await db.update(featureRequests)
          .set({ status: "feature_exists", aiDecision: result.decision, aiReasoning: result.reasoning })
          .where(eq(featureRequests.id, id));
        await writeStep(ctx, "classified", "done", { label: "Feature already exists", reasoning: result.reasoning });
        return;
      }

      if (result.decision === "out_of_scope") {
        await db.update(featureRequests)
          .set({ status: "out_of_scope", aiDecision: result.decision, aiReasoning: result.reasoning })
          .where(eq(featureRequests.id, id));
        await writeStep(ctx, "classified", "done", { label: "Out of scope", reasoning: result.reasoning });
        return;
      }

      if (result.decision === "bug_report") {
        await db.update(featureRequests)
          .set({ status: "bug_report", aiDecision: result.decision, aiReasoning: result.reasoning })
          .where(eq(featureRequests.id, id));
        await writeStep(ctx, "classified", "done", { label: "Bug report received", reasoning: result.reasoning });
        return;
      }

      // decision === "proceed" — generate PRD
      await writeStep(ctx, "prd", "running", { label: "Generating product requirements" });
      await db.update(featureRequests).set({ status: "prd_generating" }).where(eq(featureRequests.id, id));

      const prd = await generateObjectResilient({
        schema: prdSchema,
        system: "You are a senior product manager. Write a thorough PRD from the feature request below.",
        prompt: `Feature: "${req.title}"\nDetails: "${req.body}"\nAI reasoning: "${result.reasoning}"\n\nGenerate a complete PRD.`,
        modelPurpose: "default",
      });

      await db.insert(prds).values({
        featureRequestId: id,
        problemStatement: prd.problemStatement,
        goals: prd.goals,
        nonGoals: prd.nonGoals,
        userStories: prd.userStories,
        acceptanceCriteria: prd.acceptanceCriteria,
        edgeCases: prd.edgeCases,
        successMetrics: prd.successMetrics,
      });

      await db.update(featureRequests)
        .set({ status: "prd_ready", aiDecision: result.decision, aiReasoning: result.reasoning })
        .where(eq(featureRequests.id, id));

      await writeStep(ctx, "prd", "done", { label: "PRD ready for review" });
      });
    } catch (err) {
      // Persist failure status + a safe error message so the portal can show a clear state.
      // runWorkflow already wrote the failed workflow step, so polling terminates immediately.
      const errMsg = err instanceof Error ? err.message : String(err);
      const safeMsg = errMsg.length > 0 && errMsg.length < 500
        ? errMsg
        : "The intake workflow encountered an unexpected error.";
      await db.update(featureRequests)
        .set({ status: "failed", aiReasoning: safeMsg })
        .where(eq(featureRequests.id, id))
        .catch(() => {}); // best-effort — never swallow the rethrow
      throw err; // rethrow so Inngest marks the run as failed, not silently succeeded
    }
  },
);
