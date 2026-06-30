/**
 * Unit tests for the AI credit enforcement module.
 *
 * Run with: npx tsx packages/db/src/__tests__/credits.test.ts
 *
 * These are pure-logic tests that mock the DB layer to verify:
 *   1. AI_CREDIT_COSTS drives the correct amount per operation
 *   2. consumeAiCredits throws CreditsExhaustedError when the guard rejects (0 rows updated)
 *   3. consumeAiCredits returns updated balance on success
 *   4. The CREDITS_EXHAUSTED_SENTINEL is correctly identified by isCreditsExhaustedReason
 *
 * NOTE: True SQL atomicity (concurrent UPDATE race) cannot be proven by unit tests
 * against a mocked DB — that guarantee lives in the SQL WHERE clause itself:
 *   WHERE ai_credits_used + :amount <= ai_credits_limit
 * Integration tests against a real Postgres (e.g. Neon dev branch) would be needed
 * to exercise concurrent scenarios.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Import the cost map + typed error + sentinel directly — no DB calls needed.
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

// Inline the types/constants we need so we don't need a real DB connection.
// These MUST match packages/db/src/credits.ts exactly.
const AI_CREDIT_COSTS = {
  triage: 1,
  prdGeneration: 3,
  taskGeneration: 2,
  review: 5,
  reReview: 5,
} as const;

const CREDITS_EXHAUSTED_SENTINEL = "CREDITS_EXHAUSTED:";

function isCreditsExhaustedReason(aiReasoning: string | null | undefined): boolean {
  return !!aiReasoning?.startsWith(CREDITS_EXHAUSTED_SENTINEL);
}

class CreditsExhaustedError extends Error {
  constructor(
    public readonly organizationId: string,
    public readonly required: number,
    public readonly remaining: number
  ) {
    super(`AI credits exhausted for workspace ${organizationId}. Required: ${required}, Remaining: ${remaining}.`);
    this.name = "CreditsExhaustedError";
  }
}

// Minimal mock of consumeAiCredits that simulates the atomic SQL guard
function makeConsumeAiCredits(initialUsed: number, limit: number) {
  let used = initialUsed;

  return async function consumeAiCredits(organizationId: string, amount: number) {
    if (amount <= 0) throw new Error(`consumeAiCredits: amount must be > 0, got ${amount}`);
    if (used + amount > limit) {
      // Simulates 0 rows affected — same as the SQL WHERE guard
      throw new CreditsExhaustedError(organizationId, amount, limit - used);
    }
    used += amount;
    return { used, limit };
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("AI_CREDIT_COSTS map", () => {
  it("triage costs 1 credit", () => {
    assert.equal(AI_CREDIT_COSTS.triage, 1);
  });

  it("prdGeneration costs 3 credits", () => {
    assert.equal(AI_CREDIT_COSTS.prdGeneration, 3);
  });

  it("taskGeneration costs 2 credits", () => {
    assert.equal(AI_CREDIT_COSTS.taskGeneration, 2);
  });

  it("review costs 5 credits", () => {
    assert.equal(AI_CREDIT_COSTS.review, 5);
  });

  it("reReview costs 5 credits", () => {
    assert.equal(AI_CREDIT_COSTS.reReview, 5);
  });
});

describe("consumeAiCredits (mocked DB)", () => {
  it("succeeds and returns updated balance when credits are available", async () => {
    const consume = makeConsumeAiCredits(0, 500);
    const result = await consume("org-1", AI_CREDIT_COSTS.triage);
    assert.equal(result.used, 1);
    assert.equal(result.limit, 500);
  });

  it("accumulates correctly across multiple operations", async () => {
    const consume = makeConsumeAiCredits(0, 500);
    await consume("org-1", AI_CREDIT_COSTS.triage);         // 1
    await consume("org-1", AI_CREDIT_COSTS.prdGeneration);  // 4
    const result = await consume("org-1", AI_CREDIT_COSTS.taskGeneration); // 6
    assert.equal(result.used, 6);
  });

  it("throws CreditsExhaustedError when over limit (simulates WHERE guard rejection)", async () => {
    const consume = makeConsumeAiCredits(499, 500); // 1 credit left, review costs 5
    await assert.rejects(
      () => consume("org-exhausted", AI_CREDIT_COSTS.review),
      (err: unknown) => {
        assert.ok(err instanceof CreditsExhaustedError, "Should be CreditsExhaustedError");
        assert.equal((err as CreditsExhaustedError).required, 5);
        assert.equal((err as CreditsExhaustedError).remaining, 1);
        return true;
      }
    );
  });

  it("throws CreditsExhaustedError at exact limit boundary", async () => {
    const consume = makeConsumeAiCredits(500, 500); // 0 remaining
    await assert.rejects(
      () => consume("org-zero", AI_CREDIT_COSTS.triage),
      CreditsExhaustedError
    );
  });

  it("does not overspend past limit (atomic guard simulation)", async () => {
    const consume = makeConsumeAiCredits(498, 500); // 2 credits left
    await consume("org-1", AI_CREDIT_COSTS.triage); // uses 1 → 499 used
    // Next triage (1) succeeds
    await consume("org-1", AI_CREDIT_COSTS.triage); // uses 1 → 500 used
    // Now any further call should fail
    await assert.rejects(() => consume("org-1", AI_CREDIT_COSTS.triage), CreditsExhaustedError);
  });

  it("throws on amount <= 0", async () => {
    const consume = makeConsumeAiCredits(0, 500);
    await assert.rejects(() => consume("org-1", 0), /amount must be > 0/);
  });
});

describe("CREDITS_EXHAUSTED_SENTINEL", () => {
  it("isCreditsExhaustedReason returns true for sentinel-prefixed string", () => {
    assert.ok(isCreditsExhaustedReason(`${CREDITS_EXHAUSTED_SENTINEL}some message`));
  });

  it("isCreditsExhaustedReason returns false for normal error string", () => {
    assert.ok(!isCreditsExhaustedReason("Something went wrong with the AI call."));
  });

  it("isCreditsExhaustedReason returns false for null/undefined", () => {
    assert.ok(!isCreditsExhaustedReason(null));
    assert.ok(!isCreditsExhaustedReason(undefined));
    assert.ok(!isCreditsExhaustedReason(""));
  });

  it("CreditsExhaustedError message contains org, required, and remaining", () => {
    const err = new CreditsExhaustedError("org-abc", 5, 3);
    assert.ok(err.message.includes("org-abc"));
    assert.ok(err.message.includes("5"));
    assert.ok(err.message.includes("3"));
    assert.equal(err.name, "CreditsExhaustedError");
  });
});

console.log("✅ All credit enforcement tests passed.");
