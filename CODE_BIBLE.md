# Code Bible — ShipFlow (Claire)

> Load this before EVERY Antigravity prompt (code or UI). These are non-negotiable rules and the skill map. Pair with `DESIGN_BIBLE.md` + `DESIGN.md` for any UI work.

---

## Golden rules (repeat every session)

1. **Stay inside the existing Turbo monorepo. Never re-scaffold. Edit in place.**
2. **tRPC for all client↔server.** No `fetch` to your own API from the client.
3. **All money / credit / AI gating goes through the server.** Never trust the client.
4. **Webhook signatures verified with `crypto.timingSafeEqual`, never `===`.** (GitHub + Razorpay.)
5. **No hardcoded GitHub/PR data. Real Octokit calls only.**
6. **Multi-tenant isolation:** every org-scoped query/mutation filters by `ctx.orgId`. No procedure can read another org's data.
7. **GitHub auth = GitHub App installation tokens** (short-lived), not a stored long-lived PAT. If a PAT is ever stored, encrypt at rest.
8. **After each prompt:** run `pnpm build` (or `pnpm typecheck`) and fix ALL type errors before declaring done.
9. **Inngest for long work.** Anything slow (PRD gen, task gen, repo analysis, reviews, readiness) runs as a step function and records `workflow_steps` scoped by `entityId`.
10. **AI calls go through `packages/ai` `safeGenerate`** (schema-repair retry). Never call the model raw with an unvalidated schema.
11. **PRD Acceptance Criteria must remain structured** (`{ id, text }[]`). AI PR reviews (`review.ts`) must reconcile against the canonical PRD criteria list and enforce code evidence guards (`FILE_REF_RE`).

---

## Skills cheat-sheet (load the named ones at the top of each prompt)

| Skill | Use it for |
|---|---|
| `frontend-design` | Any page/visual work — bans generic AI UI, forces committed direction |
| `design-taste-frontend` | Landing, portal, hero — anti-generic, reference-driven |
| `impeccable` | Layout, spacing, typography, multi-panel pages |
| `emil-design-eng` | Motion, transitions, confetti, status animations |
| `ponytail` | Any code — minimal, clean, no over-engineering |
| `api-security-best-practices` | Webhooks, auth, tokens, Razorpay, GitHub App |
| (optional) `framer-motion` | If you want the motion layer built on Framer Motion |

**Quick map:** backend → `ponytail` (+ `api-security-best-practices` for webhooks/auth/billing). UI → `frontend-design` + `impeccable` + `emil-design-eng` + `ponytail` (+ `design-taste-frontend` for landing/portal/hero).

---

## Prompt header template (copy into every prompt)

```
Load skills: [pick from cheat-sheet].
Code Bible: follow all golden rules. Edit in place in the existing Turbo monorepo.
[UI prompts only:] Design system: follow DESIGN.md exactly + DESIGN_BIBLE.md direction.
                   Use globals.css tokens — never invent hex. Anti-patterns are hard bans.
End with: pnpm build passes, zero type errors.
```

---

## Definition of done (every prompt)

- `pnpm build` passes, zero type errors.
- No `fetch` to own API; all data via tRPC.
- Org isolation holds (no cross-tenant reads).
- Webhooks (if touched) verify signatures with `timingSafeEqual` and always return 200.
- No hardcoded GitHub/PR data.
- The prompt's own ACCEPTANCE list is satisfied.
