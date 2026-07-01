# Design Bible — ShipFlow (Claire)

> Load this before EVERY **UI** prompt, alongside `DESIGN.md`. This is the fast session primer (direction + intent). `DESIGN.md` is the precise spec (tokens, scale, hard bans). Use both: this for the "why", DESIGN.md for the "exact".

---

DESIGN DIRECTION — ShipFlow (read before writing any UI):

**COLOR** (Cartesia-derived, already in globals.css — use the tokens, do not invent hex):
- Primary brand / CTA: Deep Forest Green ~#0B462C (solid fill, white text).
- Backgrounds: warm off-white canvas (owned tint, not cream/parchment). NO gradient-blob heroes, NO dark-mode acid-green default.
- Text: charcoal near-black for headers/body; medium gray for secondary; muted gray for meta/timestamps.
- Accents stay rare — green is for action and emphasis only, never decoration. ≤ 10% surface coverage.

**TYPE** (already loaded):
- Display/headings: Playfair Display — sharp high-contrast serif = editorial authority. Use with restraint, large sizes only. Never for body, labels, buttons, or data.
- Body/UI: DM Sans — geometric, legible, for everything functional.
- Data/code/branch names/metrics: DM Mono.
- Set a real scale (major third); headings are a moment, not just bigger text.

**STRUCTURE** (Linear-inspired):
- Quiet, dense, confident. Hairline 1px dividers, generous whitespace, left-aligned forms.
- Pill buttons: filled green (primary), ghost/outline (secondary). Rounded, never sharp.
- Status = small mono pill tags (use the existing 7-tier badge system).
- Multi-panel pages use fixed column ratios; the action/decision column is sticky.
- Requirement Coverage blocks use gradual revelation (accordion collapsed by default when 100% met, expanded when partial or not_met).

**MOTION** (Benji Taylor "Family Values" — 3 principles, apply deliberately):
1. Gradual revelation — never dump all info at once; reveal detail when relevant so context is never lost. Every tap feels intentional (slide-overs, expand-on-demand, progressive setup bar, status-driven center pane).
2. Fluidity — seamless, continuous transitions between states/screens. No jarring jumps, no white reload flash. Static/abrupt = cheap.
3. Selective delight — rare high-impact moments only: confetti on Ship, a special reveal on PRD-ready / review-passed. Never sprinkle effects everywhere.
- Portal + feature-detail center pane: crossfade only (outgoing fades to 0, then incoming fades in), never slide.
- Respect prefers-reduced-motion (globals.css supports it): reduced motion keeps every state reachable, just without transition/confetti/pulse.

**COPY VOICE:**
- Plain verbs, sentence case, no filler, no hype. Name things by what the user controls.
- Buttons say exactly what happens ("Approve & ship", not "Submit"). Same word through the whole flow (button "Ship" → toast "Shipped").
- Empty states are invitations to act (icon + one warm line + one action). Errors say what broke and how to fix it, never apologize vaguely.
- Banned words: seamlessly, powerful, robust, streamline, supercharge, unlock.
- Toasts: green = completed actions, yellow = warnings, red = failures. No info-blue.

**LOADING:** skeletons only, never spinners. Skeleton matches the real layout it replaces.

**WOW BUDGET:** spend boldness in ONE place per screen. Everything else stays quiet. If two things compete for attention, cut one.
