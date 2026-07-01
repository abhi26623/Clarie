# PRD Detail Page — Polish & Muted-Semantic Color (v2)
Target route: apps/web/src/app/(app)/requests/[id]/page.tsx  (confirmed)
Scope: request/PRD detail page only. OUT OF SCOPE: TopBar / SlideOver / backdrop
(just fixed — no regressions, do not touch z-index there).

---

## SKILL: disciplined-frontend-change  (READ FIRST, APPLY EVERY STEP)
Production, deployed, design-system app. Contract:
1. NO GUESSING. Never assume a path, component, prop, CSS token, or class exists.
   Confirm by reading/grepping. Cite file:line for every claim and every edit.
2. DISCOVER BEFORE EDIT. Finish STEP 0 and PASTE findings before writing code.
   If a token/class you need doesn't exist, say so and propose adding it — never
   invent inline values.
3. TOKENS, NOT MAGIC VALUES. Existing design-system tokens only. No raw hex, no
   inline z-index, no arbitrary rgba. Missing token -> add to the scale, reference it.
4. PROOF OWNERSHIP (IMPORTANT — you cannot take browser screenshots on this setup):
   - YOU (Gemini) do NOT produce screenshots. Do NOT invent, describe, or claim any.
   - For each visual change, report the file:line that produces it + the expected
     rendered result in words.
   - The USER takes the before/after browser screenshots. Hand off explicitly.
5. BUILD GATE (local tsc is NOT enough — history: tsc-green != build-green != CI-green):
   - Run:  pnpm -r run typecheck  AND  pnpm --filter web build   (both must pass)
   - After push, CONFIRM the commit's GitHub Actions CI run is green (Linux) via the
     GitHub API (you can do this — you did it for ae71b4a).
6. REPORT EXACTLY. End with: files changed (path + line ranges), tokens added,
   build+CI status, and the list of changes for the user to screenshot.
If you cannot verify something, STOP and report the blocker. Never fabricate proof.

---

## GOAL
Make /requests/[id] read like a premium product spec: remove dev artifacts that
leak internal values, and add MUTED, SEMANTIC color (color == meaning). ~80% of
the page stays neutral. Color only encodes state (verdict, caution, progress,
scope). Decorative pastel is banned. Borders + icons > fills. Fills use the light
--status-*-bg tokens directly (already muted — do NOT stack extra opacity).

---

## STEP 0 — DISCOVERY (mandatory; paste answers before editing)
(Prior discovery confirmed; verify/extend these specifically:)
1. VERIFY --border-strong actually resolves. It is NOT in the discovered token
   list (only --border-subtle, --border-accent exist). Grep globals.css. If it
   does NOT exist as a CSS var, fall back to --border-subtle / --muted-foreground.
   Do NOT use var(--border-strong) unverified (see the --z-modal-bg silent-null bug).
2. WHAT IS feature.trackingToken? Report its purpose. If it is a PR token
   (claire-request-<id>), invite token, or anything auth/access-related ->
   REMOVE it from the UI entirely (do NOT make it copyable). Only surface it as a
   "Copy ID" chip if it is a harmless, non-sensitive feature identifier.
3. acceptanceCriteria SHAPE: confirm items are `string | { id, text }` (mixed) on
   this route. Group C MUST render both via: typeof x === "string" ? x : x.text
   (else you get [object Object] / crash).
4. Coverage reconcile: there is EXISTING logic (RequirementCoverageCard + review.ts:
   match by criterion id, fallback id.replace(/[^a-z0-9]/g,""), default not_met).
   REUSE it — do not hand-roll a second met/partial/not_met mapping (two sources of
   truth will drift). Confirm which aiReviews entry is the LATEST (order by createdAt
   desc); use that one's criteriaVerdicts, not an arbitrary [0].
5. Section small-caps label class: confirm the ONE shared class (eyebrow vs
   text-label — you were unsure). Report whether it's used app-wide. If shared,
   recoloring it in globals.css turns EVERY page's labels green — decide if that's
   intended; if PRD-only, scope it to this page instead.
6. Confirm the status enum->label source (StatusBadge renders raw {status}).

---

## CHANGE PLAN

### Group A — De-dev the UI
A1. Status pill: render human label ("prd_ready" -> "PRD Ready") via an enum->label
    map (extend StatusBadge or map before passing in). Not an ad-hoc string replace.
A2. Tracking token: per STEP 0 #2 — REMOVE from header if sensitive; only if it's a
    harmless feature id, move it to the Properties rail as a copy-on-click "Copy ID".
A3. Title: SENTENCE CASE ONLY (capitalize first character), or leave as stored.
    Do NOT word-by-word title-case (mangles "OAuth"->"Oauth", "iOS"->"Ios",
    "API"->"Api"). Presentation only — never mutate stored data.

### Group C — Acceptance Criteria bound to real verdicts (highest value)
C1. Render each criterion handling BOTH shapes (string | {id,text}).
C2. No review yet -> NEUTRAL hollow-circle marker (not a green check).
C3. Review exists -> reuse the existing reconcile helper; per criterion:
    met     -> --status-success-* (2px left border) + lucide <Check> + faint bg
    partial -> --status-warning-* (2px left border) + lucide <AlertTriangle> + faint bg
    not_met -> --status-error-*   (2px left border) + lucide <X>            + faint bg
    (Use the light --status-*-bg token as the fill; no extra opacity.)
C4. Summary line "X of Y met" — count ONLY met (partial != met). Reuse the review's
    stored metCount/totalCount if present; do not recompute a different number.

### Group D — Scope & progress cues
D1. Goals card wrapper: 2px brand-green left border (--green-800). (Put it on the
    section card container, not the <li> — Goals are a <ul>.)
D2. Non-Goals card wrapper: 2px neutral left border (--border-subtle or verified
    --border-strong) + muted text. Green-vs-neutral contrast = scope in/out.
D3. Stepper (stepper.tsx + globals.css): done = green fill + green connector;
    current = green ring/dot; future = neutral gray (verified token).
D4. Section labels: tint the ONE shared label class muted green (--green-800), per
    STEP 0 #5 scope decision.
D5. Edge Cases: 2px --status-warning-* left border + amber <AlertTriangle>.
NEVER use --status-info-* anywhere (info-blue is banned).

### Group E — Optional (lowest priority; only if not cluttered)
E1. Admin Plan Review bar -> sticky footer. Use a z-index TOKEN (not hardcoded z-10)
    and a subtle top border (NOT shadow-lg — heavy shadow fights the flat aesthetic).
E2. Keep Goals/Non-Goals/Success Metrics as plain lists/tags; reserve boxed rows for
    Acceptance Criteria (where the verdict badge lives).

### Group F — Persist the rules (so future prompts inherit them)
F1. [MODIFY] CODE_BIBLE.md: append the SKILL block above as a reusable
    "Frontend change discipline" section (process law for every UI change).
F2. [MODIFY] DESIGN_BIBLE.md: append the muted semantic color table + the
    "borders/icons over fills, fills <=8%, 80% neutral, color==meaning, no info-blue"
    principles as a "PRD / detail-page color" section (design law).

---

## MUTED SEMANTIC COLOR — reference table (use EXACT verified tokens)
| Element                          | Intent    | Treatment                                |
|----------------------------------|-----------|------------------------------------------|
| Section small-caps labels        | brand     | text = --green-800 (muted)               |
| Stepper done                     | brand     | green fill + green connector             |
| Stepper current                  | brand     | green ring/dot                           |
| Stepper future                   | neutral   | gray (verified token)                    |
| Goals card                       | scope-in  | 2px --green-800 left border              |
| Non-Goals card                   | scope-out | 2px neutral left border, muted text      |
| Criterion (no review)            | neutral   | hollow circle marker                     |
| Criterion met                    | success   | 2px --status-success-border + ✓ + bg     |
| Criterion partial                | warning   | 2px --status-warning-border + ⚠ + bg     |
| Criterion not_met                | error     | 2px --status-error-border + ✕(<X>) + bg  |
| Edge Cases                       | warning   | 2px --status-warning-border + ⚠ icon     |
| Success Metrics                  | neutral   | plain tags; optional green icon accent   |
| Status pill                      | brand     | existing green pill, label "PRD Ready"   |

---

## DESIGN CONSTRAINTS (DESIGN_BIBLE.md)
Semantic tokens only (success/warning/error/brand green #0B462C on #F9F7F3, OKLCH).
BANNED: info-blue, gradients/gradient-text, glassmorphism, mesh, glows >8px,
radius >16px, dark theme, saturated pastel fills. Fills muted (light -bg tokens).
Never tint prose (Problem Statement, User Stories). Skeletons, not spinners.

---

## VERIFICATION
GEMINI does:
- pnpm -r run typecheck  &&  pnpm --filter web build   (both green — paste output)
- After push: confirm the commit's Linux CI run is green (GitHub API).
- Report every visual change as file:line + expected rendered result.
- Confirm OUT OF SCOPE untouched (TopBar/SlideOver/backdrop).
- Do NOT produce or claim screenshots.
USER does (handoff — Gemini lists exactly what to check):
- before/after screenshots, light theme, real data:
  * header shows "PRD Ready" + sentence-case title, no raw token
  * Goals (green edge) vs Non-Goals (neutral edge) distinct
  * stepper green done/current, gray future; Edge Cases amber
  * Acceptance Criteria: NEUTRAL on a request with NO review, and
    met/partial/not_met colors on a request WITH a review (screenshot BOTH states)
- overall page still reads calm/neutral (accents only).

## REPORT BACK
Files changed (path + lines), tokens added, typecheck+build+CI status, and the
checklist of items for the user to screenshot. List any unverifiable risks.
