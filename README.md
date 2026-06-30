# Claire

**Turn a one-line idea into shipped code — with AI doing the clarifying, speccing, planning, reviewing, and you doing the approving.**

Claire is an AI-assisted product delivery platform. You describe a feature in plain language; Claire clarifies the ambiguities, writes the PRD, breaks it into tasks, opens the work on GitHub, reviews the resulting pull request, and walks it through an approval gate to "shipped" — all on one visible pipeline.

> **Core loop:** idea → AI clarifies → PRD → tasks → code → AI review → approve → **ship** 🚢

![Claire pipeline](docs/pipeline.gif)
<!-- TODO: record the pipeline gif after deploy and drop it at docs/pipeline.gif -->

---

## 🔗 Live demo

| | |
|---|---|
| **Live URL** | <!-- TODO: add Vercel URL after deploy --> |
| **Demo login** | `demo@claire.app` / `demo123456` |
| **Demo video** | **https://www.youtube.com/watch?v=QrYOWCcL3cU** |

The demo workspace ("Claire Demo") is pre-seeded with features spanning every stage of the pipeline, so you can explore the full lifecycle immediately after signing in.

---

## 🧱 Tech stack

| Layer | Choice |
|---|---|
| **Monorepo** | Turborepo + pnpm workspaces |
| **Web** | Next.js 14 (App Router) |
| **API** | tRPC v11 |
| **Database** | Drizzle ORM + Neon Postgres |
| **Auth** | BetterAuth (organization plugin, GitHub OAuth) |
| **AI** | Vercel AI SDK via OpenRouter (@openrouter/ai-sdk-provider) — tiered multi-model:<br/>Gemini 2.5 Flash / Flash-Lite, GLM-5.2, Claude Sonnet 4.6 |
| **Background jobs** | Inngest |
| **GitHub** | Octokit GitHub App (+ OAuth App for login) |
| **Payments** | Razorpay (test mode) |

---

## 🏗️ Architecture

```mermaid
flowchart LR
  U[User] --> W[Next.js + tRPC]
  W --> DB[(Neon Postgres)]
  GH[GitHub webhooks] --> IN[Inngest functions]
  IN --> AI[OpenRouter (multi-model)]
  IN --> DB
  W -->|create order / verify| RZ[Razorpay]
  W -->|OAuth + App| GH
```

**Monorepo layout**

```
apps/
  web/              # Next.js app — UI, tRPC route handler, auth + webhook endpoints
packages/
  db/               # Drizzle schema, migrations, Neon client
  auth/             # BetterAuth config, org plugin, shared demo-workspace helper
  api/              # tRPC routers (organization, feature, billing, …)
  ui/               # shared design-system components (@claire/ui)
  jobs/             # Inngest client + workflow functions
  github/           # Octokit GitHub App helpers (listRepos, getPR, postReview)
  ai/               # OpenRouter / Gemini wrapper (generateObjectResilient)
  config/           # Shared env schema
```

---

## 📱 App pages

| Route | Description |
|---|---|
| `/dashboard` | Pipeline board — all feature requests across every stage, with the "New request" slide-over and keyboard shortcut `N` |
| `/features` | Full feature request backlog — same pipeline strip + card list as the dashboard, dedicated view |
| `/requests/[id]` | Feature detail — full timeline, PRD, tasks, clarification threads, PR links, workflow steps |
| `/approvals` | Admin-only approval queue — features in `ready_for_approval` with AI review summaries |
| `/approvals/[id]` | Approval decision page — PRD summary, AI review findings, task completion, Approve & Ship / Send back |
| `/reviews` | AI code review list |
| `/reviews/[id]` | AI review detail — inline issues, severity breakdown, diff context |
| `/settings` | Settings hub — links to GitHub integration, team members, and billing |
| `/settings/github` | GitHub App installation + connected repos |
| `/settings/members` | Team members list (name, email, role, join date) + invite link generation for admins/owners |
| `/billing` | Plan status + Razorpay upgrade flow |
| `/p/[slug]` | Public feature request portal (no login required) |
| `/p/[slug]/r/[token]` | Public request tracking page (submitter view) |
| `/join/[token]` | Workspace invite link redemption |
| `/onboarding` | New workspace creation flow |

---

## 🔁 The pipeline (the heart of Claire)

Every feature request moves through a single status enum (`feature_status`) that drives the board columns and the AI workflow:

```
received → analyzing → (clarification_needed ↔ accepted)
  → prd_generating → prd_ready → tasks_generating → tasks_ready
  → in_development → in_review → (fix_needed ↻)
  → ready_for_approval → shipped
```

**Terminal / branch states:** `duplicate`, `feature_exists`, `bug_report`, `out_of_scope`, `rejected`, `failed`.

**Full enum values** (from `packages/db/src/schema.ts`, exact casing):

```
received | analyzing | clarification_needed | accepted | duplicate |
feature_exists | bug_report | out_of_scope | prd_generating | prd_ready |
tasks_generating | tasks_ready | in_development | in_review | fix_needed |
ready_for_approval | shipped | rejected | failed
```

**Dashboard board columns map to status buckets:**

| Column | Statuses |
|---|---|
| Discovery | `received`, `analyzing`, `clarification_needed`, `accepted`, `duplicate`, `feature_exists`, `bug_report`, `out_of_scope`, `failed` |
| Planning | `prd_generating`, `prd_ready`, `tasks_generating`, `tasks_ready` |
| Building | `in_development`, `fix_needed` |
| Reviewing | `in_review` |
| Approval | `ready_for_approval`, `rejected` |
| Shipped | `shipped` |

---

## 🚀 Local setup

```bash
pnpm i                       # install
cp .env.example .env         # fill in your values (see table below)
pnpm db:push                 # push the Drizzle schema to your Neon DB
pnpm run seed                # seed the "Claire Demo" workspace
pnpm inngest dev             # start the Inngest dev server (or: npx inngest-cli dev)
pnpm dev                     # start the app on http://localhost:3000
```

> A committed `.env.example` lists every variable with empty values. Never commit a real `.env`.

---

## 🔐 Environment variables

| Variable | Description | Where to get it |
|---|---|---|
| `DATABASE_URL` | Neon Postgres connection string | Neon dashboard |
| `BETTER_AUTH_SECRET` | Secret for signing sessions | generate (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | App base URL (`http://localhost:3000` locally; prod URL in prod) | your domain |
| `NEXT_PUBLIC_APP_URL` | Public app URL (used by client) | your domain |
| `GITHUB_CLIENT_ID` | OAuth App client id (login) | GitHub → Settings → Developers → OAuth Apps |
| `GITHUB_CLIENT_SECRET` | OAuth App client secret (login) | same |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay key id (client checkout) | Razorpay dashboard → API keys |
| `RAZORPAY_KEY_ID` | Razorpay key id (server) | same |
| `RAZORPAY_KEY_SECRET` | Razorpay key secret (server only) | same |
| `GITHUB_APP_ID` | GitHub App id (repo integration) | GitHub → Settings → Developers → GitHub Apps |
| `GITHUB_APP_CLIENT_ID` | GitHub App client id | same |
| `GITHUB_APP_CLIENT_SECRET` | GitHub App client secret | same |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App private key (PEM) | generate in the App settings |
| `GITHUB_APP_WEBHOOK_SECRET` | Verifies incoming GitHub webhooks | you choose it (set in the App) |
| `OPENROUTER_API_KEY` | OpenRouter key for AI calls | openrouter.ai |
| `OPENROUTER_MODEL_LIGHT` | Override light tier model | openrouter.ai (default: `google/gemini-2.5-flash-lite`) |
| `OPENROUTER_MODEL_DEFAULT` | Override default tier model | openrouter.ai (default: `google/gemini-2.5-flash`) |
| `OPENROUTER_MODEL_REVIEW` | Override review tier model | openrouter.ai (default: `z-ai/glm-5.2`) |
| `OPENROUTER_MODEL_PREMIUM_REVIEW` | Override premium review tier model | openrouter.ai (default: `anthropic/claude-sonnet-4.6`) |
| `INNGEST_SIGNING_KEY` | Inngest signing key (prod) | Inngest dashboard |
| `INNGEST_EVENT_KEY` | Inngest event key (prod) | Inngest dashboard |

*(All values are placeholders here — no secrets are committed.)*

---

## 🗄️ Database schema notes

Key tables (see `packages/db/src/schema.ts`):

| Table | Purpose |
|---|---|
| `user`, `account`, `session` | BetterAuth identity (email/password + GitHub) |
| `organization`, `member` | Workspaces and membership/roles |
| `workspace_settings` | Per-org plan + limits (`plan`, `aiCreditsLimit`, `aiCreditsUsed`, `repoLimit`, `memberLimit`) |
| `invite_links` | Tokenized join links (`token`, `organizationId`, `expiresAt`) — reusable 7-day tokens consumed by `/join/[token]` |
| `feature_requests` | Feature requests + their `feature_status` (drives the pipeline) |
| `workflow_steps` | Polymorphic progress log (`entityType`, `entityId`, `step`, `status`) — written by Inngest functions to record each pipeline step. **Note:** uses a polymorphic `(entityType, entityId: text)` pattern with no typed FK; query directly with `eq(workflowSteps.entityId, String(id))` — do **not** join via Drizzle `with: { workflowSteps }` (will 500). |
| `prds` | Product requirements documents (1:1 with feature) |
| `tasks` | Engineering tasks broken down from a PRD |
| `repositories` | Connected GitHub repos + installation tracking |
| `pull_requests` | Tracked PRs linked to features |
| `pull_request_files` | Per-file diff data for PR reviews |
| `ai_reviews` | AI code review results + pass/fail status |
| `review_issues` | Individual issues from reviews (BLOCKING / NON_BLOCKING / SUGGESTION) |
| `approvals` | Admin approval decisions on features |
| `payments` | Razorpay orders/upgrades (idempotent FREE→PRO) |
| `billing_orders` | Order tracking for billing |
| `webhook_logs` | Stored GitHub webhook deliveries (enables offline replay in the demo) |

**Plans:** FREE = 500 AI credits / 3 repos / 10 members · PRO = 5 000 / 25 / 50.

---

## 🐙 GitHub integration

Claire uses **two** GitHub apps:
- an **OAuth App** for user login (`/api/auth/callback/github`), and
- a **GitHub App** for repository access (code, PRs, webhooks).

**GitHub App setup**
1. Create a GitHub App (Settings → Developers → GitHub Apps).
2. **Permissions required** (derived from the Octokit calls in `packages/github/src/index.ts`):

   | Scope | Level | Used by |
   |---|---|---|
   | **Pull requests** | Read & Write | `pulls.get`, `pulls.listFiles`, `pulls.createReview` |
   | **Issues** | Read & Write | `issues.createComment` (fallback review posting) |
   | **Metadata** | Read-only | `apps.listReposAccessibleToInstallation` |

3. **Webhook URL:** `https://<your-domain>/api/webhooks/github`
4. **Webhook secret:** set it and store as `GITHUB_APP_WEBHOOK_SECRET`.
5. **Subscribe to events:** `pull_request`, `installation`, `installation_repositories`.
6. Generate a **private key** → `GITHUB_APP_PRIVATE_KEY`.
7. **Install** the App on the repos you want Claire to manage.

**Webhook replay (demo):** every delivery is persisted in `webhook_logs`, so the "Replay Webhook" action can re-run a stored delivery offline — handy for demoing the review flow without a live PR.

---

## ⚙️ Inngest workflows

Each AI step runs as an Inngest function so long-running work happens off the request path. All functions live in `packages/jobs/src/functions/`.

| Function ID | Event(s) | File | What it does |
|---|---|---|---|
| `feature-intake` | `feature/intake` | `intake.ts` | Triages a new feature request. **Steps:** `analyze` → classify (proceed / duplicate / feature_exists / clarification_needed / bug_report / out_of_scope) → if proceed: `prd` → generate PRD → set `prd_ready`. |
| `feature-clarification-answered` | `feature/clarification.answered` | `clarification.ts` | Re-evaluates after a user answers a clarification question. **Steps:** `re-analyze` → re-classify with answer context → if proceed: `prd` → generate PRD → set `prd_ready`. |
| `prd-approved` | `prd/approved` | `prd.ts` | Generates engineering tasks from an approved PRD. **Steps:** `tasks` → AI breaks PRD into typed/prioritized tasks → insert task rows → set `tasks_ready`. |
| `github-pr-review` | `github/pr.opened`, `github/pr.synchronize` | `review.ts` | Full AI code review of a pull request. **Steps:** `fetching_context` → load PR + feature + PRD + previous reviews → `fetching_diff` → fetch + budget diff files (≤40 files, ≤80k tokens) → `create_review_row` → `analyzing_code` → AI generates issues → `save_and_diff` → persist + diff resolved issues → `update_feature` → set `fix_needed` or `ready_for_approval` → `posting_github` → post inline review (fallback: plain comment). |
| `feature-shipped` | `feature/shipped` | `ship.ts` | Records the ship event. **Steps:** compute `timeToShipDays` → set `shipped` → write workflow step. |

Additionally, a `noop` function (`noop/run`) exists in `packages/jobs/src/index.ts` for Inngest dev-server connectivity testing.

---

## 🤖 AI features

All model calls go through OpenRouter. Model selection is cost-aware, tiered, and routed via a shared `generateObjectResilient` helper (Zod validation + graceful failure).

| Tier | Model | Used for |
|---|---|---|
| **light** | `google/gemini-2.5-flash-lite` | Quick / lightweight background tasks |
| **default** | `google/gemini-2.5-flash` | General AI workflows + fallback |
| **review** | `z-ai/glm-5.2` | Standard PR / code review |
| **premiumReview** | `anthropic/claude-sonnet-4.6` | Premium code review |

> **Note:** PR/code review uses GLM-5.2 (standard) and Claude Sonnet 4.6 (premium review), while routine generation (clarification, PRD, tasks) uses the Gemini 2.5 Flash tier.

Implemented capabilities:

- **Triage & classification** — surfaces duplicates, existing features, out-of-scope, and bug reports before any work begins.
- **Clarification** — asks targeted clarifying questions (text, multiple choice, or yes/no) when requirements are ambiguous.
- **PRD generation** — structured product spec (problem, goals, non-goals, user stories, acceptance criteria, edge cases, success metrics).
- **Task generation** — PRD → discrete, typed (`FEATURE` / `BUG` / `CHORE` / `TEST` / `DOCS`), prioritized, independently shippable tasks with suggested branch names.
- **AI code review** — reviews the PR diff against the linked PRD; flags issues with severity (`BLOCKING` / `NON_BLOCKING` / `SUGGESTION`) and type (requirement mismatch, security, performance, missing tests, etc.). Posts inline GitHub review comments with fallback to plain comment.
- **Re-review & issue diffing** — on subsequent pushes, resolved issues from the previous review are fingerprinted and marked resolved automatically.

---

## 💳 Billing (Razorpay, test mode)

One-time **Upgrade to Pro** flow: server-created order → Razorpay Standard Checkout → server-side signature verification → idempotent FREE→PRO upgrade in `workspace_settings`.

**Testing:** International cards are disabled on a default Indian Razorpay account, so use **Netbanking** or **UPI `success@razorpay`** in test mode. Test card (if enabled): `4111 1111 1111 1111`, any future expiry, any CVV.

---

## ✅ Demo walkthrough

1. Sign in as `demo@claire.app` / `demo123456`.
2. Explore the pre-seeded board across all pipeline stages.
3. **Submit a new feature** via the "New request" button or `N` shortcut → watch AI triage it live in the slide-over panel.
4. **Browse the full backlog** at `/features` — use the pipeline stage tabs to filter by Discovery / Planning / Building / etc.
5. **Approve a PRD** on a `prd_ready` feature → tasks generate.
6. **Review an approval** on a `ready_for_approval` feature → inspect PRD summary, AI review findings, and task completion.
7. **Ship a feature** → confetti 🎉.
8. **Explore Settings** → navigate to `/settings` for the hub, `/settings/github` to connect repos, `/settings/members` to view the team and generate an invite link.
9. **Invite a team member** — generate a reusable 7-day link at `/settings/members`, open it in an incognito window, confirm `/join/[token]` adds the member.
10. **Replay a webhook** to re-run an AI review offline.
11. **Upgrade to Pro** via Razorpay test checkout.

---

## 📄 License

MIT
