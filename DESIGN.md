# Design System — ShipFlow (Claire)

> Single source of truth for visual + interaction design. Every UI prompt must reference this file. Tokens live in `globals.css` — use them, never invent hex values. The anti-patterns list is a set of hard bans.

---

## Theme

**Register:** product — design serves the workflow, not the brand.
**Mode:** light (warm off-white canvas; the UI is used in daylit offices).
**Color strategy:** Restrained — tinted neutrals + one accent ≤ 10% surface coverage.
**Wow budget:** one element earns emphasis per screen (size, motion, or color). Everything around it stays quiet. If two things compete for attention, cut one.

---

## Palette

All colors in OKLCH. Hue anchor: **148** (deep forest green = `#0B462C`).
Canvas tilt: +0.01 chroma toward hue 90 (warm, not generically cream).

| Token | OKLCH | Hex approx | Role |
|---|---|---|---|
| `--canvas` | `oklch(0.975 0.006 90)` | `#F9F7F3` | Page background |
| `--surface` | `oklch(0.965 0.005 100)` | `#F5F3EF` | Card / panel bg |
| `--surface-raised` | `oklch(0.955 0.006 95)` | `#F0EDE8` | Inset / code bg |
| `--surface-overlay` | `oklch(0.930 0.008 100)` | `#EAE7E2` | Hover fill |
| `--ink` | `oklch(0.22 0.016 255)` | `#1C1E26` | Charcoal body text |
| `--ink-secondary` | `oklch(0.42 0.014 255)` | `#595E6E` | Secondary labels |
| `--ink-tertiary` | `oklch(0.58 0.010 255)` | `#888FA0` | Meta / timestamps |
| `--ink-inverse` | `oklch(0.97 0.004 90)` | `#F7F5F2` | Text on green bg |
| `--green-800` | `oklch(0.32 0.10 148)` | `#0B462C` | **Brand anchor** |
| `--accent` | `var(--green-800)` | `#0B462C` | Primary action |
| `--border` | `oklch(0.875 0.008 255)` | `#D8D5D0` | Default hairline |
| `--border-subtle` | `oklch(0.920 0.005 255)` | `#E7E4DF` | Table dividers |
| `--border-accent` | `oklch(0.46 0.08 148)` | `#2E6B49` | Focus ring hairline |

### Status color tiers

| Tier | Use | Pulses? |
|---|---|---|
| `neutral` | received, todo, duplicate, out-of-scope, feature-exists | No |
| `info` | analyzing, in-development, in-review, in-progress, running | **Yes** |
| `generating` | prd-generating, tasks-generating (purple hue) | **Yes** |
| `active` | accepted, prd-ready, tasks-ready, ready-for-approval | No |
| `warning` | clarification-needed, fix-needed, bug-report, needs-changes, sent-back | No |
| `success` | shipped, done, pass, approved | No |
| `error` | rejected, failed, fail | No |

**Pulse rule:** the dot pulses on `info` and `generating` only (in-flight work). Never pulse `neutral`, `active`, `warning`, `success`, `error`. Pulse stops under `prefers-reduced-motion`.

---

## Typography

**Display / headings:** Playfair Display (serif) — editorial authority, legible at size.
**Body / UI:** DM Sans (geometric sans) — neutral, wide optical-size range.
**Code / mono values:** DM Mono — clean, matches DM Sans weight rhythm.

### Type scale (major third, 1.250 ratio, base 16px)

| Token | Value | Use |
|---|---|---|
| `--text-2xs` | 0.64rem / 10px | Micro-labels, mono chips |
| `--text-xs` | 0.75rem / 12px | Captions, timestamps |
| `--text-sm` | 0.875rem / 14px | Secondary body, labels |
| `--text-base` | 1rem / 16px | Primary body |
| `--text-md` | 1.125rem / 18px | Lead prose |
| `--text-lg` | 1.25rem / 20px | Subsection headings |
| `--text-xl` | 1.5rem / 24px | Section headings (sans) |
| `--text-2xl` | 1.875rem / 30px | Page title (sans) |
| `--text-3xl` | 2.25rem / 36px | Display sm (serif) |
| `--text-4xl` | 3rem / 48px | Display md (serif) |
| `--text-5xl` | 3.75rem / 60px | Display lg (serif) |
| `--text-6xl` | `clamp(3rem, 6vw, 4.5rem)` | Hero (capped ≤ 6rem) |

**Letter-spacing floor:** `-0.03em` for display (never tighter than `-0.04em`).
**Line length cap:** `max-width: 65ch` on body paragraphs.
**Pairing rule:** serif for display moments only (page titles, hero, section display). Never set body, labels, buttons, or data in serif.

---

## Spacing

4px base, 8-point rhythm. Scale: `--space-1` (4px) → `--space-32` (128px).
Key values: `--space-4` (16px) base unit, `--space-8` (32px) section gap.

---

## Border radius

Cards: `--radius-md` (8px, max 16px). Inputs/buttons: `--radius-base` (6px).
Pills/badges: `--radius-pill` (9999px). **No card radius above 16px.**

---

## Borders

**Hairline discipline:** 1px everywhere. Never use side-stripe borders.
Never pair `border` + `box-shadow` on the same element — pick one.
Shadow max blur: `8px`. Use `--shadow-sm` (4px) for default card elevation.

---

## Layout

- **One bold element per screen.** The hero pipeline animation, the ship confetti, the PRD reveal — pick the single moment that carries the screen and keep everything else quiet.
- Left-aligned forms. Hairline dividers over boxes. Generous whitespace over decoration.
- Multi-panel pages (feature detail, approval) use fixed column ratios; the decision/action column is sticky.
- Max content width on text-heavy pages; full-bleed only for the landing hero.

---

## Components

### StatusBadge (`packages/ui/src/status-badge.tsx`)

- Monospace chip, `--text-2xs`, uppercase, `--radius-pill`
- Leading 5px dot; dot pulses (`badge__dot--pulse`) on `info` + `generating` tiers only
- Seven semantic tiers, each owning `bg / fg / border-color` via CSS custom properties
- Color is never the sole signal — text label always present (`title` attribute for a11y)
- Import: `import { StatusBadge } from "@claire/ui"`

### Loading states

- **Always skeleton, never spinner.** No centered activity indicators on full pages.
- Skeleton shape must match the real layout it replaces: same column count, same row count, same card structure.
- No layout shift when skeleton swaps to real content.

### Empty states

- One Lucide icon + one warm line + one primary action. Never blank, never apologetic.
- Examples: "Your pipeline is empty. Submit your first feature idea." / "Connect GitHub to enable AI code reviews."

### shadcn mapping

All shadcn primitives auto-inherit via CSS variable aliasing in `globals.css`:
- `--background / --foreground` → canvas / ink
- `--primary / --primary-foreground` → green-800 / ink-inverse
- `--border` → 1px solid `--border` (hairline)
- `--radius` → `--radius-base` (6px)
- `--ring` → green-800 focus ring

---

## Motion

Grounded in three principles (Benji Taylor, "Family Values"):

1. **Gradual revelation** — never dump all info at once. Reveal detail when it becomes relevant (slide-overs, expand-on-demand, progressive setup bar, status-driven center pane). Every tap feels intentional.
2. **Fluidity** — seamless, continuous transitions between states and routes. No jarring jumps, no white flash. Static/abrupt feels cheap.
3. **Selective delight** — rare, high-impact moments only (ship confetti, a special reveal on PRD-ready / review-passed). Never sprinkle effects everywhere.

### Tokens & timing

- `--ease-out-expo` for entrances, `--ease-out-quart` for hovers.
- `--duration-fast` (100ms) for color transitions, `--duration-enter` (220ms) for elements.
- Pulse dot: 1.6s ease-in-out infinite.
- **All animation gated on `prefers-reduced-motion: reduce`** — reduced motion keeps every state and screen reachable, just without transition/confetti/pulse.

### State transitions (portal + feature detail center pane)

- **Crossfade only:** opacity 0→1, `--duration-enter` (220ms), `--ease-out-expo`.
- Outgoing state fades to 0 **before** incoming fades in (sequential, not simultaneous).
- Never slide content left/right between states — there's no spatial model here.
- Route changes crossfade; never a white reload flash.

---

## Copy voice

- **Sentence case everywhere.** Never title case on buttons or headings.
- Buttons name exactly what happens: "Approve & ship", "Generate plan", "Copy branch", "Send back for fixes".
- **Same word through the whole flow:** if the button says "Ship", the success toast says "Shipped". If it says "Publish", the toast says "Published".
- Name things by what the user controls, not how the system is built ("notifications", not "webhook config").
- Empty states: one warm line + one action. Inviting, never apologetic.
- Errors: say what broke **and** how to fix it. Never "Something went wrong."
- No filler: ban "seamlessly", "powerful", "robust", "streamline", "supercharge", "unlock".

### Toast semantics (sonner)

- **Success (green):** completed actions only — approved, shipped, connected, copied.
- **Warning (yellow):** non-blocking issues, approaching a limit.
- **Error (red):** failures only, with what + how-to-fix.
- **No info-blue.** Every toast is success, warning, or error.

---

## Anti-patterns (hard bans for this project)

- No side-stripe `border-left` as accent
- No gradient text (`background-clip: text`)
- No glassmorphism as default
- No cream/sand/parchment body bg (using owned warm tint, not the AI default)
- No neon glows or colored `box-shadow` > 8px blur
- No card `border-radius` > 16px
- No Inter font
- No numbered section markers as scaffolding (only where content is a genuine sequence, e.g. the core-loop "how it works")
- No spinners as loading states (skeletons only)
- No serif for body, labels, buttons, or data
- No slide transitions between portal/center-pane states (crossfade only)
- No info-blue toasts
- No filler marketing words (see Copy voice)
