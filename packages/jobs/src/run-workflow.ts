import { db, workflowSteps } from "@claire/db";
import { and, eq } from "drizzle-orm";

/**
 * Wrap every workflow body. On any throw, write a TERMINAL "failed" workflowSteps
 * row with the real error message before re-throwing, so the live UI never hangs
 * on a pulsing state, and the exact error is visible in the dev server.
 */
export async function runWorkflow(
  ctx: { entityType: string; entityId: string },
  body: () => Promise<void>,
) {
  try {
    await body();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    // Upsert the "failed" step — overwrite any existing "failed" row for this entity
    // so we don't leave a stale row from a mid-retry failure alongside a running step.
    await writeStep(ctx, "failed", "failed", { label: `Failed: ${message}`, message, stack });
    throw err;
  }
}


/**
 * Write (or overwrite) a single workflow step for a logical step name.
 *
 * Uses delete-then-insert so that retried steps produce exactly ONE final row
 * per logical step name. This prevents the "Failed + Running at the same time"
 * contradiction that appears when generateObjectResilient retries after an error:
 * the failed intermediate row is replaced, not accumulated.
 *
 * The "failed" step written by runWorkflow is similarly idempotent — retrying a
 * whole workflow won't leave two "failed" rows.
 */
export async function writeStep(
  ctx: { entityType: string; entityId: string },
  step: string,
  status: "running" | "done" | "failed",
  partialResult?: unknown,
) {
  // Delete any existing row for this logical step before inserting the new state.
  // This is intentionally NOT a transaction — a brief window where no row exists
  // is acceptable; the UI shows "Starting…" for a moment. The alternative
  // (using ON CONFLICT DO UPDATE) would require a unique index migration.
  await db.delete(workflowSteps).where(
    and(
      eq(workflowSteps.entityType, ctx.entityType),
      eq(workflowSteps.entityId, ctx.entityId),
      eq(workflowSteps.step, step),
    )
  );

  await db.insert(workflowSteps).values({
    entityType: ctx.entityType,
    entityId: ctx.entityId,
    step,
    status,
    partialResult: partialResult as object | undefined,
  });
}
