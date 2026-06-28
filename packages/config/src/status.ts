// Single source of truth for status enums + allowed transitions.

export const FEATURE_REQUEST_STATUS = [
  "received", "analyzing", "clarification_needed", "accepted",
  "duplicate", "feature_exists", "bug_report", "out_of_scope",
  "prd_generating", "prd_ready", "tasks_generating", "tasks_ready",
  "in_development", "in_review", "fix_needed", "ready_for_approval",
  "shipped", "rejected", "failed",
] as const;
export type FeatureRequestStatus = (typeof FEATURE_REQUEST_STATUS)[number];

export const TASK_STATUS = ["todo", "in_progress", "in_review", "done"] as const;
export type TaskStatus = (typeof TASK_STATUS)[number];

export const REVIEW_VERDICT = ["pass", "fail", "needs_changes"] as const;
export type ReviewVerdict = (typeof REVIEW_VERDICT)[number];

export const APPROVAL_DECISION = ["approved", "rejected", "sent_back"] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISION)[number];

export const WORKFLOW_STEP_STATUS = ["running", "done", "failed"] as const;
export type WorkflowStepStatus = (typeof WORKFLOW_STEP_STATUS)[number];

// Terminal states the live UI must treat as "stop pulsing".
export const TERMINAL_STEP_STATUSES: WorkflowStepStatus[] = ["done", "failed"];

// Allowed feature-request transitions (guardrails, not exhaustive enforcement).
export const FEATURE_TRANSITIONS: Record<string, FeatureRequestStatus[]> = {
  received: ["analyzing", "failed"],
  analyzing: ["clarification_needed", "accepted", "duplicate", "feature_exists", "bug_report", "out_of_scope", "failed"],
  clarification_needed: ["accepted", "out_of_scope", "failed"],
  accepted: ["prd_generating", "failed"],
  prd_generating: ["prd_ready", "failed"],
  prd_ready: ["tasks_generating", "rejected", "failed"],
  tasks_generating: ["tasks_ready", "failed"],
  tasks_ready: ["in_development", "failed"],
  in_development: ["in_review", "failed"],
  in_review: ["fix_needed", "ready_for_approval", "failed"],
  fix_needed: ["in_review", "failed"],
  ready_for_approval: ["shipped", "fix_needed", "rejected", "failed"],
};

export function canTransition(from: FeatureRequestStatus, to: FeatureRequestStatus): boolean {
  return FEATURE_TRANSITIONS[from]?.includes(to) ?? false;
}

export const PLAN_LIMITS = {
  free: { aiCredits: 200, repoLimit: 3 },
  pro: { aiCredits: 5000, repoLimit: 50 },
} as const;
export type Plan = keyof typeof PLAN_LIMITS;
