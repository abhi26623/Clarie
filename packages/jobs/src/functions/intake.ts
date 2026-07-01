import { z } from "zod";
import { eq, ne, and, inArray, desc, notInArray } from "drizzle-orm";
import { db, featureRequests, clarificationThreads, prds, workflowSteps, AI_CREDIT_COSTS, consumeAiCredits, CreditsExhaustedError, CREDITS_EXHAUSTED_SENTINEL } from "@claire/db";
import { generateObjectResilient } from "@claire/ai";
import { inngest } from "../client";
import { runWorkflow, writeStep } from "../run-workflow";

export const ACTIVE_TRIAGE_STATUSES = [
  "received", "analyzing", "clarification_needed", "accepted",
  "prd_generating", "prd_ready", "tasks_generating", "tasks_ready",
  "in_development", "in_review", "fix_needed", "ready_for_approval", "shipped"
] as const;

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

export async function getWorkspaceExistingFeaturesContext(organizationId: string, currentId: number): Promise<string> {
  const existingReqs = await db.select({
    id: featureRequests.id,
    title: featureRequests.title,
    body: featureRequests.body,
    status: featureRequests.status,
  })
  .from(featureRequests)
  .where(and(
    eq(featureRequests.organizationId, organizationId),
    ne(featureRequests.id, currentId),
    inArray(featureRequests.status, [...ACTIVE_TRIAGE_STATUSES] as any)
  ))
  .orderBy(desc(featureRequests.createdAt))
  .limit(15);

  if (existingReqs.length === 0) return "";

  return `\n\nExisting workspace features:\n` + existingReqs.map(r => {
    const snippet = r.body && r.body.length > 200 ? r.body.slice(0, 200) + "..." : r.body || "(no description)";
    return `- #${r.id}: "${r.title}" (status: ${r.status})\n  Summary: ${snippet}`;
  }).join("\n");
}

export const TRIAGE_SYSTEM_PROMPT = `You are a senior product manager triaging feature requests. Classify the request precisely. Never reference source code.

STEP 1 — VAGUENESS CHECK (do this FIRST, before anything else):
If the request is a single word or short phrase (e.g. "chart", "notification", "search", "export", "reporting", "analytics"), or is missing format / scope / location / user / trigger details, you MUST return decision="clarification_needed" with ONE multiple-choice question inside the 'clarification' object. You MUST set questionType="CHOICE" with 2-4 options. Returning "proceed", "duplicate", or "feature_exists" on a vague or single-word request is a FAILURE.

STEP 2 — Only if the request is specific and concrete (clear scope + format + location + behavior), then evaluate:
- If the request CLEARLY and SUBSTANTIVELY matches an already-shipped feature from 'Existing workspace features' -> return "feature_exists" and in 'reasoning', name the matching feature (ID + title) in a user-friendly, educational tone.
- If the request CLEARLY and SUBSTANTIVELY matches an in-progress or planned request from 'Existing workspace features' -> return "duplicate" and cite the matching feature.
- Only use "duplicate" or "feature_exists" when there is a GENUINE, substantive match. When uncertain, return "clarification_needed" per STEP 1.
- If the request is specific, novel, and concrete -> return "proceed".

FEW-SHOT DECISION BOUNDARY EXAMPLES (JSON OUTPUT MATCHING SCHEMA EXACTLY):

❌ Example 1 (Single word / vague -> ASK first):
Request: "notification"
Output:
{
  "decision": "clarification_needed",
  "reasoning": "The request is a single word with no scope, trigger, channel, or user context.",
  "clarification": {
    "question": "What type of notification do you need, and where should it be delivered?",
    "questionType": "CHOICE",
    "options": ["Email notification for new comments", "In-app push notification for task updates", "Slack alert for approval decisions"]
  }
}

❌ Example 2 (Short phrase / vague -> ASK first):
Request: "Add an export button"
Output:
{
  "decision": "clarification_needed",
  "reasoning": "The request specifies an export button but omits file format, screen, and data scope.",
  "clarification": {
    "question": "What should the export contain and in what format?",
    "questionType": "CHOICE",
    "options": ["CSV from Reports table", "PDF invoice summary", "Excel full dump"]
  }
}

✅ Example 3 (Concrete -> PROCEED directly):
Request: "Add a CSV export button to the top-right of the reports table that downloads the currently filtered rows."
Output:
{
  "decision": "proceed",
  "reasoning": "The request explicitly defines format (CSV), location (top-right of reports table), and behavior (downloads filtered rows)."
}

✅ Example 4 (Concrete -> PROCEED directly):
Request: "Add a weekly task completion bar chart widget to the top row of the overview dashboard."
Output:
{
  "decision": "proceed",
  "reasoning": "The request clearly defines widget type (bar chart), data metric (weekly completion), and placement (top row, overview dashboard)."
}`;

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
  problemStatement: z.string().describe("2-3 concise sentences explaining the core problem."),
  goals: z.array(z.string().describe("One concise sentence per goal.")),
  nonGoals: z.array(z.string().describe("One concise sentence per non-goal.")),
  userStories: z.array(z.string().describe("One concise sentence per user story.")),
  acceptanceCriteria: z.array(z.object({ id: z.string(), text: z.string().describe("One concise sentence per criterion.") })),
  edgeCases: z.array(z.string().describe("One concise sentence per edge case.")),
  successMetrics: z.array(z.string().describe("One concise sentence per metric.")),
});

export const intakeWorkflow = inngest.createFunction(
  {
    id: "feature-intake",
    retries: 2,
    timeouts: { finish: "4m" },
    onFailure: async ({ event }) => {
      // Reconcile on failure
      const reqId = event.data.event.data.featureRequestId as number;
      await reconcileIntakeFailure(reqId);
    }
  },
  { event: "feature/intake" },
  async ({ event, step }) => {
    const id = event.data.featureRequestId as number;
    const ctx = { entityType: "feature_request", entityId: String(id) };

    try {
      await runWorkflow(ctx, async () => {
      const [req] = await db.select().from(featureRequests).where(eq(featureRequests.id, id));
      if (!req) throw new Error(`Feature request ${id} not found`);

      await writeStep(ctx, "analyze", "running", { label: "Analyzing your request" });
      await db.update(featureRequests)
        .set({ status: "analyzing" })
        .where(and(eq(featureRequests.id, id), notInArray(featureRequests.status, ["analyzing", "prd_generating", ...POST_TRIAGE_PHASES] as any)));

      const existingContext = await getWorkspaceExistingFeaturesContext(req.organizationId, id);

      const result = await step.run("triage-decision", async () => {
        return await generateObjectResilient({
          schema: decisionSchema,
          system: TRIAGE_SYSTEM_PROMPT,
          prompt: `Feature request title: "${req.title}"\nDetails: "${req.body}"${existingContext}\n\nClassify and decide how to handle it.`,
          modelPurpose: "light",
          maxAttempts: 1,
          timeoutMs: 30_000,
        });
      });

      // Consume triage credit AFTER successful classification.
      // Wrapped in step.run for true Inngest idempotency across retries.
      const triageCredit = await step.run("consume-triage", async () => {
        try {
          await consumeAiCredits(req.organizationId, AI_CREDIT_COSTS.triage);
          return { ok: true } as { ok: boolean, msg?: string };
        } catch (err: any) {
          if (err instanceof CreditsExhaustedError) return { ok: false, msg: err.message };
          throw err;
        }
      });

      if (!triageCredit.ok) {
        await db.update(featureRequests)
          .set({ status: "failed", aiReasoning: `${CREDITS_EXHAUSTED_SENTINEL}${triageCredit.msg}` })
          .where(eq(featureRequests.id, id));
        await writeStep(ctx, "failed", "failed", { label: "Credits exhausted" });
        return; // Halt workflow gracefully (Inngest run succeeds)
      }

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
      await db.update(featureRequests)
        .set({ status: "prd_generating" })
        .where(and(eq(featureRequests.id, id), notInArray(featureRequests.status, [...POST_TRIAGE_PHASES] as any)));

      const prd = await step.run("generate-prd", async () => {
        return await generateObjectResilient({
          schema: prdSchema,
          system: "You are a senior product manager. Write a thorough PRD from the feature request below. Generate acceptanceCriteria as an array of objects with a short unique slug id (e.g. 'auth-redirect', 'rate-limit-header') and a text field. Never use bare numbers as ids.",
          prompt: `Feature: "${req.title}"\nDetails: "${req.body}"\nAI reasoning: "${result.reasoning}"\n\nGenerate a complete PRD. Generate 3-5 goals, 3-6 acceptance criteria, and 2-4 edge cases to keep the PRD rich but focused.`,
          modelPurpose: "default",
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
            .set({ status: "prd_ready", aiDecision: result.decision, aiReasoning: result.reasoning })
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
      
      throw err; // Rethrow so Inngest marks run as failed and retries
    }
  },
);

export const intakeWorkflowCancel = inngest.createFunction(
  { id: "feature-intake-cancel-handler", retries: 0 },
  { event: "inngest/function.cancelled" },
  async ({ event }) => {
    // React to both feature-intake and feature-clarification-answered cancellations
    if (event.data.function_id === "feature-intake" || event.data.function_id === "feature-clarification-answered") {
      // Inngest cancellation events include the original event in `event.data.event`
      const originalEvent = event.data.event as any;
      if (originalEvent?.data?.featureRequestId) {
        await reconcileIntakeFailure(originalEvent.data.featureRequestId);
      }
    }
  }
);
