import { router, publicProcedure } from "./trpc";
import { organizationRouter } from "./routers/organization";
import { featureRouter } from "./routers/feature";
import { prdRouter } from "./routers/prd";
import { taskRouter } from "./routers/task";
import { githubRouter } from "./routers/github";
import { reviewRouter } from "./routers/review";
import { approvalRouter } from "./routers/approval";
import { billingRouter } from "./routers/billing";
import { workflowRouter } from "./routers/workflow";
import { actionCenterRouter } from "./routers/action-center";

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true, ts: Date.now() })),
  
  organization: organizationRouter,
  feature: featureRouter,
  prd: prdRouter,
  task: taskRouter,
  github: githubRouter,
  review: reviewRouter,
  approval: approvalRouter,
  billing: billingRouter,
  workflow: workflowRouter,
  actionCenter: actionCenterRouter,
});

export type AppRouter = typeof appRouter;
