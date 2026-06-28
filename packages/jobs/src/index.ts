import { inngest } from "./client";
import { intakeWorkflow } from "./functions/intake";

export { inngest };
export { runWorkflow, writeStep } from "./run-workflow";

const noop = inngest.createFunction(
  { id: "noop" },
  { event: "noop/run" },
  async () => ({ ok: true }),
);

export const functions = [noop, intakeWorkflow];
