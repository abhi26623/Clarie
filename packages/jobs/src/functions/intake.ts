import { z } from "zod";
import { eq, ne, and, inArray, desc } from "drizzle-orm";
import { db, featureRequests, clarificationThreads, prds, AI_CREDIT_COSTS, consumeAiCredits, CreditsExhaustedError, CREDITS_EXHAUSTED_SENTINEL } from "@claire/db";
import { generateObjectResilient } from "@claire/ai";
import { inngest } from "../client";
import { runWorkflow, writeStep } from "../run-workflow";

export const ACTIVE_TRIAGE_STATUSES = [
  "received", "analyzing", "clarification_needed", "accepted",
  "prd_generating", "prd_ready", "tasks_generating", "tasks_ready",
  "in_development", "in_review", "fix_needed", "ready_for_approval", "shipped"
] as const;

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

MANDATORY CLARIFICATION RULE:
If the request is vague, ambiguous, missing critical scope/format/location details, or could be implemented in multiple conflicting ways, you MUST return decision="clarification_needed" with ONE specific multiple-choice question inside the 'clarification' object with questionType="CHOICE". Only return "proceed" when the request is concrete enough to generate unambiguous acceptance criteria. When unsure, ASK — do not guess.

CRITICAL TRIAGE RULES FOR DUPLICATES & EXISTING FEATURES:
- If the new request CLEARLY and SUBSTANTIVELY matches an already-shipped feature from 'Existing workspace features' -> return "feature_exists" and in 'reasoning', name the matching feature (ID + title) in a user-friendly, educational tone explaining how it covers their needs.
- If the new request CLEARLY and SUBSTANTIVELY matches an in-progress or planned request from 'Existing workspace features' -> return "duplicate" and in 'reasoning', cite the matching feature (ID + title) explaining that the team is already working on it.
- Only use "duplicate" or "feature_exists" when there is a GENUINE, substantive match. When uncertain or when the request proposes genuinely novel functionality, follow the MANDATORY CLARIFICATION RULE.

FEW-SHOT DECISION BOUNDARY EXAMPLES (JSON OUTPUT MATCHING SCHEMA EXACTLY):

❌ Example 1 (Vague -> ASK):
Request: "Add an export button"
Output:
{
  "decision": "clarification_needed",
  "reasoning": "The request specifies an export button but omits file format and UI location.",
  "clarification": {
    "question": "What file format should the export download, and which screen should have the button?",
    "questionType": "CHOICE",
    "options": ["CSV from Reports table", "PDF invoice summary", "Excel full dump"]
  }
}

✅ Example 2 (Concrete -> PROCEED):
Request: "Add a CSV export button to the top-right of the reports table that downloads the currently filtered rows."
Output:
{
  "decision": "proceed",
  "reasoning": "The request explicitly defines exact feature scope, format (CSV), location (reports table), and behavior."
}

❌ Example 3 (Vague -> ASK):
Request: "Make the dashboard better and show productivity metrics."
Output:
{
  "decision": "clarification_needed",
  "reasoning": "The request mentions productivity metrics but omits specific KPI definitions and layout placement.",
  "clarification": {
    "question": "Which primary productivity metric would your team find most valuable on the overview dashboard?",
    "questionType": "CHOICE",
    "options": ["Tasks completed per sprint", "Average PR review time", "AI credits saved per week"]
  }
}

✅ Example 4 (Concrete -> PROCEED):
Request: "Add a weekly task completion bar chart widget to the top row of the overview dashboard."
Output:
{
  "decision": "proceed",
  "reasoning": "The request clearly defines widget type (bar chart), data metric (weekly completion), and placement."
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
  async ({ event, step }) => {
    const id = event.data.featureRequestId as number;
    const ctx = { entityType: "feature_request", entityId: String(id) };

    try {
      await runWorkflow(ctx, async () => {
      const [req] = await db.select().from(featureRequests).where(eq(featureRequests.id, id));
      if (!req) throw new Error(`Feature request ${id} not found`);

      await writeStep(ctx, "analyze", "running", { label: "Analyzing your request" });
      await db.update(featureRequests).set({ status: "analyzing" }).where(eq(featureRequests.id, id));

      const existingContext = await getWorkspaceExistingFeaturesContext(req.organizationId, id);

      const result = await step.run("triage-decision", async () => {
        return await generateObjectResilient({
          schema: decisionSchema,
          system: TRIAGE_SYSTEM_PROMPT,
          prompt: `Feature request title: "${req.title}"\nDetails: "${req.body}"${existingContext}\n\nClassify and decide how to handle it.`,
          modelPurpose: "light",
          maxAttempts: 2,
          timeoutMs: 12_000,
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
      await db.update(featureRequests).set({ status: "prd_generating" }).where(eq(featureRequests.id, id));

      await step.run("generate-prd", async () => {
        const prd = await generateObjectResilient({
          schema: prdSchema,
          system: "You are a senior product manager. Write a thorough PRD from the feature request below.",
          prompt: `Feature: "${req.title}"\nDetails: "${req.body}"\nAI reasoning: "${result.reasoning}"\n\nGenerate a complete PRD.`,
          modelPurpose: "default",
          maxAttempts: 1,
          timeoutMs: 48_000,
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
      
      throw err; // Rethrow so Inngest marks run as failed and retries
    }
  },
);
