import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, featureRequests, prds, tasks, AI_CREDIT_COSTS, consumeAiCredits, CreditsExhaustedError, CREDITS_EXHAUSTED_SENTINEL } from "@claire/db";
import { generateObjectResilient } from "@claire/ai";
import { inngest } from "../client";
import { runWorkflow, writeStep } from "../run-workflow";

const taskSchema = z.object({
  title: z.string(),
  description: z.string().describe("One concise sentence describing the task. Max ~140 chars."),
  type: z.enum(["FEATURE", "BUG", "CHORE", "TEST", "DOCS"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  estimatedHours: z.number().int().positive(),
});

const tasksSchema = z.object({
  tasks: z.array(taskSchema).min(1).max(20),
});

export const prdApprovedWorkflow = inngest.createFunction(
  { id: "prd-approved" },
  { event: "prd/approved" },
  async ({ event, step }) => {
    const id = event.data.featureRequestId as number;
    const ctx = { entityType: "feature_request", entityId: String(id) };

    await runWorkflow(ctx, async () => {
      const [req] = await db.select().from(featureRequests).where(eq(featureRequests.id, id));
      if (!req) throw new Error(`Feature request ${id} not found`);

      const [prd] = await db.select().from(prds).where(eq(prds.featureRequestId, id));
      if (!prd) throw new Error(`PRD not found for feature request ${id}`);

      // Bug #8: if tasks already exist for this feature, do not regenerate (dedupe on replay/double-click)
      const existingTasks = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.featureRequestId, id));
      if (existingTasks.length > 0) {
        await db.update(featureRequests).set({ status: "tasks_ready" }).where(eq(featureRequests.id, id));
        await writeStep(ctx, "tasks", "done", { label: `${existingTasks.length} tasks already exist`, count: existingTasks.length });
        return;
      }

      // Bug #21/#11: consume BEFORE generating so we never sit stuck in "tasks_generating" with no tasks
      const taskCredit = await step.run("consume-task-gen", async () => {
        try {
          await consumeAiCredits(req.organizationId, AI_CREDIT_COSTS.taskGeneration);
          return { ok: true } as { ok: boolean, msg?: string };
        } catch (err: any) {
          if (err instanceof CreditsExhaustedError) return { ok: false, msg: err.message };
          throw err;
        }
      });
      if (!taskCredit.ok) {
        await db.update(featureRequests)
          .set({ status: "prd_ready", aiReasoning: `${CREDITS_EXHAUSTED_SENTINEL}${taskCredit.msg}` })
          .where(eq(featureRequests.id, id));
        await writeStep(ctx, "tasks", "failed", { label: "Credits exhausted" });
        return;
      }

      await writeStep(ctx, "tasks", "running", { label: "Generating engineering tasks" });
      await db.update(featureRequests).set({ status: "tasks_generating" }).where(eq(featureRequests.id, id));

      const taskCount = await step.run("generate-tasks", async () => {
        const result = await generateObjectResilient({
          schema: tasksSchema,
          system: "You are a senior engineering lead. Break down the PRD into actionable engineering tasks. Each task should be independently shippable. Use suggestedBranch names like 'feat/dark-mode-toggle'. Prefer FEATURE type unless clearly a bug, chore, test, or docs task.",
          prompt: `Feature: "${req.title}"\n\nPRD:\nProblem: ${prd.problemStatement}\nGoals: ${JSON.stringify(prd.goals)}\nUser Stories: ${JSON.stringify(prd.userStories)}\nAcceptance Criteria: ${JSON.stringify((prd.acceptanceCriteria as any[])?.map((ac) => typeof ac === "string" ? ac : ac.text) ?? [])}\n\nGenerate engineering tasks to ship this feature. Keep each description to one concise sentence.`,
          modelPurpose: "default",
          maxAttempts: 1,
          timeoutMs: 55_000,
        });

        let order = 0;
        for (const task of result.tasks) {
          const safeTitle = task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          await db.insert(tasks).values({
            featureRequestId: id,
            title: task.title,
            description: task.description,
            type: task.type,
            priority: task.priority,
            estimatedHours: task.estimatedHours,
            suggestedBranch: `feat/${safeTitle}-${id}`,
            assignedToAI: false,
            order: order++,
          });
        }
        return result.tasks.length;
      });

      await db.update(featureRequests).set({ status: "tasks_ready" }).where(eq(featureRequests.id, id));
      await writeStep(ctx, "tasks", "done", { label: `${taskCount} tasks generated`, count: taskCount });
    });
  },
);
