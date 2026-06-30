import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, featureRequests, clarificationThreads, prds } from "@claire/db";
import { generateObjectResilient } from "@claire/ai";
import { inngest } from "../client";
import { runWorkflow, writeStep } from "../run-workflow";

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

export const clarificationAnsweredWorkflow = inngest.createFunction(
  { id: "feature-clarification-answered" },
  { event: "feature/clarification.answered" },
  async ({ event }) => {
    const id = event.data.featureRequestId as number;
    const ctx = { entityType: "feature_request", entityId: String(id) };

    await runWorkflow(ctx, async () => {
      const [req] = await db.select().from(featureRequests).where(eq(featureRequests.id, id));
      if (!req) throw new Error(`Feature request ${id} not found`);

      // Load the most recent answered clarification thread
      const threads = await db.select().from(clarificationThreads)
        .where(eq(clarificationThreads.featureRequestId, id));
      const answered = threads.filter(t => t.answer).sort((a, b) =>
        new Date(b.answeredAt ?? 0).getTime() - new Date(a.answeredAt ?? 0).getTime()
      )[0];

      if (!answered) throw new Error("No answered clarification thread found");

      await writeStep(ctx, "re-analyze", "running", { label: "Re-analyzing with your answer" });
      await db.update(featureRequests).set({ status: "analyzing" }).where(eq(featureRequests.id, id));

      const context = threads.map(t =>
        `Q: ${t.question}\nA: ${t.answer ?? "(unanswered)"}`
      ).join("\n\n");

      const result = await generateObjectResilient({
        schema: decisionSchema,
        system: "You are a senior product manager triaging feature requests. Classify the request precisely based on the original request and clarification answers. Never reference source code.",
        prompt: `Feature: "${req.title}"\nDetails: "${req.body}"\n\nClarification context:\n${context}\n\nClassify and decide how to handle it.`,
        modelPurpose: "light",
      });

      if (result.decision === "clarification_needed" && result.clarification) {
        // Still needs more clarification
        await db.insert(clarificationThreads).values({
          featureRequestId: id,
          question: result.clarification.question,
          questionType: result.clarification.questionType ?? "TEXT",
          options: result.clarification.options ?? null,
        });
        await db.update(featureRequests)
          .set({ status: "clarification_needed", aiDecision: result.decision, aiReasoning: result.reasoning })
          .where(eq(featureRequests.id, id));
        await writeStep(ctx, "clarification", "done", { label: "Further clarification needed", question: result.clarification.question });
        return;
      }

      if (result.decision !== "proceed") {
        const statusMap = {
          duplicate: "duplicate", feature_exists: "feature_exists",
          bug_report: "bug_report", out_of_scope: "out_of_scope",
        } as const;
        const status = statusMap[result.decision as keyof typeof statusMap] ?? "rejected";
        await db.update(featureRequests)
          .set({ status, aiDecision: result.decision, aiReasoning: result.reasoning })
          .where(eq(featureRequests.id, id));
        await writeStep(ctx, "classified", "done", { label: `Classified: ${result.decision}`, reasoning: result.reasoning });
        return;
      }

      // proceed — generate PRD
      await writeStep(ctx, "prd", "running", { label: "Generating product requirements" });
      await db.update(featureRequests).set({ status: "prd_generating" }).where(eq(featureRequests.id, id));

      const prd = await generateObjectResilient({
        schema: prdSchema,
        system: "You are a senior product manager. Write a thorough PRD from the feature request and clarification context below.",
        prompt: `Feature: "${req.title}"\nDetails: "${req.body}"\n\nClarification:\n${context}\n\nGenerate a complete PRD.`,
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
  },
);
