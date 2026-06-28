# Design System

## Theme

**Register:** product — design serves the workflow, not the brand.
**Mode:** light (warm off-white canvas; the UI is used in daylit offices).
**Color strategy:** Restrained — tinted neutrals + one accent ≤ 10% surface coverage.

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

| Tier | Use |
|---|---|
| `neutral` | received, todo, duplicate, out-of-scope, feature-exists |
| `info` | analyzing, in-development, in-review, in-progress, running |
| `generating` | prd-generating, tasks-generating (purple hue, pulse) |
| `active` | accepted, prd-ready, tasks-ready, ready-for-approval |
| `warning` | clarification-needed, fix-needed, bug-report, needs-changes, sent-back |
| `success` | shipped, done, pass, approved |
| `error` | rejected, failed, fail |

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

## Components

### StatusBadge (`packages/ui/src/status-badge.tsx`)

- Monospace chip, `--text-2xs`, uppercase, `--radius-pill`
- Leading 5px dot; dot pulses (`badge__dot--pulse`) on in-flight states
- Seven semantic tiers, each owning `bg / fg / border-color` via CSS custom properties
- Color is never the sole signal — text label always present (`title` attribute for a11y)
- Import: `import { StatusBadge } from "@claire/ui"`

### shadcn mapping

All shadcn primitives auto-inherit via CSS variable aliasing in `globals.css`:
- `--background / --foreground` → canvas / ink
- `--primary / --primary-foreground` → green-800 / ink-inverse
- `--border` → 1px solid `--border` (hairline)
- `--radius` → `--radius-base` (6px)
- `--ring` → green-800 focus ring

---

## Motion

- `--ease-out-expo` for entrances, `--ease-out-quart` for hovers.
- `--duration-fast` (100ms) for color transitions, `--duration-enter` (220ms) for elements.
- All animations gated on `prefers-reduced-motion: reduce`.
- Pulse dot: 1.6s ease-in-out infinite (stops in reduced-motion).

---

## Anti-patterns (hard bans for this project)

- No side-stripe `border-left` as accent
- No gradient text (`background-clip: text`)
- No glassmorphism as default
- No cream/sand/parchment body bg (using owned warm tint, not the AI default)
- No neon glows or colored `box-shadow` > 8px blur
- No card `border-radius` > 16px
- No Inter font
- No numbered section markers as scaffolding
