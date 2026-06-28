import { db, workflowSteps } from "@claire/db";

/**
 * Wrap every workflow body. On any throw, write a TERMINAL "failed" workflowSteps
 * row with a human message before re-throwing, so the live UI never hangs on a
 * pulsing "Generating..." state.
 */
export async function runWorkflow(
  ctx: { entityType: string; entityId: string },
  body: () => Promise<void>,
) {
  try {
    await body();
  } catch (err) {
    await db.insert(workflowSteps).values({
      entityType: ctx.entityType,
      entityId: ctx.entityId,
      step: "failed",
      status: "failed",
      partialResult: {
        message: "Something went wrong while processing this. You can retry.",
        detail: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}

export async function writeStep(
  ctx: { entityType: string; entityId: string },
  step: string,
  status: "running" | "done" | "failed",
  partialResult?: unknown,
) {
  await db.insert(workflowSteps).values({
    entityType: ctx.entityType,
    entityId: ctx.entityId,
    step,
    status,
    partialResult: partialResult as object | undefined,
  });
}
