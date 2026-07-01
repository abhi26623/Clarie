import { inngest } from "./client";
import { intakeWorkflow, intakeWorkflowCancel } from "./functions/intake";
import { clarificationAnsweredWorkflow } from "./functions/clarification";
import { prdApprovedWorkflow } from "./functions/prd";
import { featureShippedWorkflow } from "./functions/ship";
import { prReviewWorkflow } from "./functions/review";

export { inngest };
export { runWorkflow, writeStep } from "./run-workflow";

const noop = inngest.createFunction(
  { id: "noop" },
  { event: "noop/run" },
  async () => ({ ok: true }),
);

// All 5 real functions + noop. This array is spread into serve() in apps/web/src/app/api/inngest/route.ts
export const functions = [
  noop,
  intakeWorkflow,
  intakeWorkflowCancel,
  clarificationAnsweredWorkflow,
  prdApprovedWorkflow,
  featureShippedWorkflow,
  prReviewWorkflow,
];

