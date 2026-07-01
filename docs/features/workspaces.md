# Workspaces (Multi-Tenancy)

## Model

Workspaces = BetterAuth `organization` rows. Every user belongs to one or more organizations via the `member` table. The `session.active_organization_id` column (Postgres) tracks the currently active workspace and is updated on every switch.

## Scoping Rule

Every data query inside `protectedOrgProcedure` is scoped by `ctx.orgId`, which is resolved by `ensureActiveOrganization()` (`packages/auth/src/index.ts`):

1. Reads `session.active_organization_id` from the Postgres `session` table.
2. Verifies the user is a member of that org.
3. **Falls back** to the user's first membership only if `active_organization_id` is `null` — and immediately persists that value back to the session row so subsequent requests use it.
4. Switching calls `setActiveOrganization`, which updates the DB session. A page refresh always reads the persisted value.

## Creating a Workspace (`organization.create` — `packages/api/src/routers/organization.ts`)

Order of operations:
1. Slugify + deduplicate the workspace name.
2. Call `auth.api.createOrganization({ name, slug })`.
3. **Explicit membership upsert** — insert creator with `role: "owner"` (lowercase) via `db.insert(member)` with `onConflictDoNothing`. This is a safety guard independent of BetterAuth's auto-assignment.
4. Call `auth.api.setActiveOrganization({ organizationId: res.id })` — switches the active workspace in the DB session immediately.
5. **Hard credit seeding** — insert `workspace_settings` row with ALL free-tier defaults explicitly specified (never rely on DB defaults for credits):

```
plan:          "FREE"
aiCreditsUsed:  0
aiCreditsLimit: 500
repoLimit:      3
memberLimit:    10
billingStatus:  "active"
```

A `null` or `0` `aiCreditsLimit` causes every AI action to throw `CreditsExhaustedError` immediately. Always hard-seed these values.

## Switching a Workspace (`organization.switchActive`)

Calls `auth.api.setActiveOrganization` — updates `session.active_organization_id` in Postgres. On the client, the `OrgSwitcher` then calls `utils.invalidate()` + `router.refresh()` so all tRPC queries re-run against the new active org.

## UI Entry Point

`apps/web/src/components/layout/org-switcher.tsx` — rendered in `TopBar` which is mounted in `apps/web/src/app/(app)/layout.tsx`.

## See Also

- `docs/features/acceptance-criteria-coverage.md`
- `packages/auth/src/index.ts` — `ensureActiveOrganization`
- `packages/api/src/routers/organization.ts` — all organization tRPC procedures
