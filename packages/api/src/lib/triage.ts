import { z } from "zod";
import { eq, ne, and, inArray, desc } from "drizzle-orm";
import { db, featureRequests } from "@claire/db";

export const ACTIVE_TRIAGE_STATUSES = [
  "received", "analyzing", "clarification_needed", "accepted",
  "prd_generating", "prd_ready", "tasks_generating", "tasks_ready",
  "in_development", "in_review", "fix_needed", "ready_for_approval", "shipped"
] as const;

export const POST_TRIAGE_PHASES = [
  "prd_ready", "tasks_generating", "tasks_ready",
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
  .limit(5);

  if (existingReqs.length === 0) return "";

  return `\n\nExisting workspace features:\n` + existingReqs.map(r => {
    const snippet = r.body && r.body.length > 100 ? r.body.slice(0, 100) + "..." : r.body || "(no description)";
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

export const decisionSchema = z.object({
  decision: z.enum(["proceed", "duplicate", "feature_exists", "clarification_needed", "bug_report", "out_of_scope"]),
  reasoning: z.string(),
  clarification: z.object({
    question: z.string(),
    questionType: z.enum(["TEXT", "CHOICE", "YESNO"]).default("TEXT"),
    options: z.array(z.string()).max(4).optional(),
  }).optional(),
});
