import { db, workspaceSettings } from "./index";
import { eq, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// AI_CREDIT_COSTS — single source of truth for per-operation credit costs.
// All Inngest functions and tRPC pre-checks must reference this map.
// ---------------------------------------------------------------------------
export const AI_CREDIT_COSTS = {
  triage: 1,         // intake / re-analysis after clarification answer
  prdGeneration: 3,  // PRD generation (intake + clarification paths)
  taskGeneration: 2, // task breakdown from approved PRD
  review: 5,         // initial AI PR code review
  reReview: 5,       // re-review on subsequent PR pushes
} as const;

export type AiOperation = keyof typeof AI_CREDIT_COSTS;

// ---------------------------------------------------------------------------
// CreditsExhaustedError — typed error thrown when the atomic consume fails.
// Callers can check `err instanceof CreditsExhaustedError` to handle it
// without an awkward string match.
// ---------------------------------------------------------------------------
export class CreditsExhaustedError extends Error {
  constructor(
    public readonly organizationId: string,
    public readonly required: number,
    public readonly remaining: number
  ) {
    super(
      `AI credits exhausted for workspace ${organizationId}. ` +
        `Required: ${required}, Remaining: ${remaining}.`
    );
    this.name = "CreditsExhaustedError";
  }
}

// ---------------------------------------------------------------------------
// getRemainingCredits — read-only helper for pre-checks and UI data.
// ---------------------------------------------------------------------------
export async function getRemainingCredits(organizationId: string): Promise<{
  used: number;
  limit: number;
  remaining: number;
}> {
  const [settings] = await db
    .select({
      aiCreditsUsed: workspaceSettings.aiCreditsUsed,
      aiCreditsLimit: workspaceSettings.aiCreditsLimit,
    })
    .from(workspaceSettings)
    .where(eq(workspaceSettings.organizationId, organizationId));

  if (!settings) {
    // No workspace_settings row means the org was just created — treat as full capacity.
    return { used: 0, limit: 500, remaining: 500 };
  }

  const used = settings.aiCreditsUsed ?? 0;
  const limit = settings.aiCreditsLimit ?? 500;
  return { used, limit, remaining: Math.max(0, limit - used) };
}

// ---------------------------------------------------------------------------
// consumeAiCredits — ATOMIC conditional increment.
//
// Uses a single SQL UPDATE with a WHERE guard so concurrent calls cannot
// push aiCreditsUsed past aiCreditsLimit. No read-then-write race.
//
//   UPDATE workspace_settings
//     SET ai_credits_used = ai_credits_used + :amount
//     WHERE organization_id = :orgId
//       AND ai_credits_used + :amount <= ai_credits_limit
//
// Returns updated { used, limit } on success.
// Throws CreditsExhaustedError if the WHERE guard rejects (0 rows updated).
// ---------------------------------------------------------------------------
export async function consumeAiCredits(
  organizationId: string,
  amount: number
): Promise<{ used: number; limit: number }> {
  // Guard: amount must be positive
  if (amount <= 0) throw new Error(`consumeAiCredits: amount must be > 0, got ${amount}`);

  const updated = await db
    .update(workspaceSettings)
    .set({
      aiCreditsUsed: sql`${workspaceSettings.aiCreditsUsed} + ${amount}`,
    })
    .where(
      sql`${workspaceSettings.organizationId} = ${organizationId}
        AND ${workspaceSettings.aiCreditsUsed} + ${amount} <= ${workspaceSettings.aiCreditsLimit}`
    )
    .returning({
      aiCreditsUsed: workspaceSettings.aiCreditsUsed,
      aiCreditsLimit: workspaceSettings.aiCreditsLimit,
    });

  if (updated.length === 0) {
    // 0 rows affected means the WHERE guard blocked it — credits exhausted.
    const { used, limit } = await getRemainingCredits(organizationId);
    throw new CreditsExhaustedError(organizationId, amount, Math.max(0, limit - used));
  }

  return {
    used: updated[0]!.aiCreditsUsed,
    limit: updated[0]!.aiCreditsLimit,
  };
}

// ---------------------------------------------------------------------------
// CREDITS_EXHAUSTED_SENTINEL — prefix written to aiReasoning on background
// credit exhaustion so the UI can distinguish it from real AI/system failures
// and show an "Upgrade to Pro" CTA instead of a generic error message.
// ---------------------------------------------------------------------------
export const CREDITS_EXHAUSTED_SENTINEL = "CREDITS_EXHAUSTED:";

export function isCreditsExhaustedReason(aiReasoning: string | null | undefined): boolean {
  return !!aiReasoning?.startsWith(CREDITS_EXHAUSTED_SENTINEL);
}
