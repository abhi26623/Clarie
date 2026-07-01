# Acceptance-Criteria Coverage in AI Reviews

## Overview
Acceptance-Criteria Coverage bridges PRD requirements directly into engineering verification. When Claire reviews a GitHub pull request linked to a feature request, it evaluates every individual PRD acceptance criterion against the actual diff and produces an evidence-backed verdict (`met`, `partial`, or `not_met`).

## Architecture & Data Flow
1. **Structured Acceptance Criteria**: PRD acceptance criteria are stored in Postgres (`prds.acceptance_criteria`) as structured objects: `Array<{ id: string; text: string }>`. During AI feature intake and interactive clarification, each criterion is assigned a permanent alphanumeric ID (e.g., `auth-redirect`, `rate-limit`).
2. **AI Review Evaluation**: When `prReviewWorkflow` triggers (`review.ts`), it passes the canonical criteria IDs and text to the QA evaluation model. The model must return an evaluation for every criterion ID.
3. **Reconciliation & Drift Guard**: The backend reconciles AI output against the canonical PRD criteria list:
   - Any missing criterion defaults to `not_met` ("Not implemented in this diff.").
   - Normalized matching recovers minor model typos in IDs while logging warnings.
   - Code guard regex (`FILE_REF_RE`) verifies that any `met` verdict cites an actual code file extension (`.ts`, `.tsx`, `.sql`, etc.); otherwise, it downgrades the verdict to `partial`.
4. **Storage**: Verdicts are saved in `ai_reviews.criteria_verdicts` (`jsonb`).

## Presentation Layers
- **GitHub PR Comment**: Displays a checklist table under `### 📋 Requirement Coverage (metCount/totalCount)` directly above blocking issues.
- **In-App Review Page (`/reviews/[id]`)**: Renders an expandable Requirement Coverage card displaying status badges (`Met`, `Partial`, `Not Met`) and code file evidence.
- **Human Approval Screen (`/approvals/[id]`)**: Shows Requirement Coverage inside the AI Review Findings block, providing QA verification before merging/shipping.
