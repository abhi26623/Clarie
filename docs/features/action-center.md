# Action Center

Top-bar bell dropdown aggregating actionable items for the active workspace.

## Buckets

| Bucket | Source | Status value | Link destination | Role gate |
|:---|:---|:---|:---|:---|
| Clarifications needed | `featureRequests` | `"clarification_needed"` | `/requests/[featureId]` | All members |
| Awaiting approval | `featureRequests` | `"ready_for_approval"` | `/approvals/[featureId]` | `"admin"` / `"owner"` only |
| Needs fixes | `featureRequests` | `"fix_needed"` | `/requests/[featureId]` | All members |

## Design decisions

- **Badge = true `count()`** — never capped at the display limit of 5. If 7 approvals exist, the badge shows 7.
- **Rows = top-5 by `updatedAt` desc** — with a "+N more — view all" link to the full list page if `trueCount > 5`.
- **Zero drift with `/approvals` page** — `approval.listPending` (approval.ts:24-28) uses the identical filter (`featureRequests.status = "ready_for_approval"` scoped to `orgId`). The true count shown on the badge must always equal what the `/approvals` list shows.

## Link id types (proven from page sources)

- `/requests/[id]` — takes `featureRequests.id` (integer). All three buckets use this id.
- `/approvals/[id]` — takes `featureRequests.id` (proven: `approvals/[id]/page.tsx:26,35-36` calls `approval.getContext({ featureId: id })`).
- `/reviews/[id]` is **not used** — it takes an `aiReviews.id` (proven: `reviews/[id]/page.tsx:348` calls `review.getById({ id })`), which is not available from a `featureRequests` query without a join. Needs-fixes items link to `/requests/[featureId]` instead.

## Role scoping

`ctx.memberRole` is set by `protectedOrgProcedure` via `ensureActiveOrganization` (trpc.ts:24). For non-admin/non-owner members, the `approvalsPending` count is hardcoded to `0` and the items array to `[]` — the section simply doesn't render.

## Color tokens (verbatim from globals.css:78-96)

| Bucket | bg token | fg token |
|:---|:---|:---|
| Clarifications | `var(--status-warning-bg)` | `var(--status-warning-fg)` |
| Approvals | `var(--status-active-bg)` | `var(--status-active-fg)` |
| Needs fixes | `var(--status-error-bg)` | `var(--status-error-fg)` |
| Empty state | `var(--status-success-bg)` | `var(--status-success-fg)` |

Color is applied **only** to the icon chip and the count badge. Row text uses `var(--ink)`.
