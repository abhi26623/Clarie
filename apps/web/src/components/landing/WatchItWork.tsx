"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Check, AlertTriangle } from "lucide-react";
import { StatusBadge } from "@claire/ui";
import { SectionWash } from "./SectionWash";

// ─── Timeline ────────────────────────────────────────────────────────────────
const STEPS = [
  { id: "analyze", label: "Analyzing request" },
  { id: "dupe",    label: "Checking for duplicates" },
  { id: "problem", label: "Generating problem statement" },
  { id: "ac",      label: "Acceptance criteria" },
  { id: "edge",    label: "Edge cases" },
];

type Phase = 0 | 1 | 2 | 3 | 4 | 5;
type StepState = "done" | "active" | "pending";

const PHASE_DURATIONS: Record<Phase, number> = {
  0: 800, 1: 1800, 2: 2000, 3: 2200, 4: 2200, 5: 2200,
};

const STEPPER_PHASES: Record<Phase, StepState[]> = {
  0: ["pending","pending","pending","pending","pending"],
  1: ["done","done","pending","pending","pending"],
  2: ["done","done","active","pending","pending"],
  3: ["done","done","done","active","pending"],
  4: ["done","done","done","done","done"],
  5: ["done","done","done","done","done"],
};

const THINKING_LINES: Record<Phase, string[]> = {
  0: [],
  1: ["Reading the request…", "No duplicates found."],
  2: ["Reading the request…", "No duplicates found.", "Drafting problem statement…"],
  3: ["Reading the request…", "No duplicates found.", "Drafting problem statement…", "Drafting acceptance criteria (4)"],
  4: ["Reading the request…", "No duplicates found.", "Drafting problem statement…", "Drafting acceptance criteria (4)", "Found 1 edge case: existing users"],
  5: ["Reading the request…", "No duplicates found.", "Drafting problem statement…", "Drafting acceptance criteria (4)", "Found 1 edge case: existing users"],
};

const ACCEPTANCE_CRITERIA = [
  "Settings page respects system & user-set preferences",
  "Toggle persists across page refreshes via localStorage",
  "All components use CSS custom properties for theming",
];

const EXPO_CSS = "var(--ease-out-expo)";
const CROSSFADE_MS = 220;

// ─── StepRow ─────────────────────────────────────────────────────────────────
function StepRow({ label, state }: { label: string; state: StepState }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-1-5) 0" }}>
      <div style={{ width: "1.25rem", height: "1.25rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {state === "done" ? (
          <Check size={14} strokeWidth={3} color="var(--status-success-fg)" />
        ) : state === "active" ? (
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", display: "block" }} />
        ) : (
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--border-strong)", display: "block" }} />
        )}
      </div>
      <span style={{
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-sm)",
        fontWeight: state === "active" ? 500 : 400,
        color: state === "pending" ? "var(--ink-tertiary)" : "var(--ink)",
      }}>
        {label}
        {state === "active" && <span style={{ color: "var(--accent)", marginLeft: 4 }}>●</span>}
        {state === "done"   && <span style={{ color: "var(--status-success-fg)", marginLeft: 6, fontSize: "var(--text-xs)" }}>✓</span>}
      </span>
    </div>
  );
}

// ─── PrdCards (always rendered; opacity controls visibility) ─────────────────
function PrdCards() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {/* Problem Statement */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "var(--space-4) var(--space-5)" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-2xs)", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-tertiary)", marginBottom: "var(--space-2)" }}>
          Problem Statement
        </p>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--ink-secondary)", lineHeight: 1.6, margin: 0 }}>
          Settings users have no way to switch between light and dark themes. The app always renders in light mode, ignoring OS preference.
        </p>
      </div>

      {/* Acceptance Criteria */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "var(--space-4) var(--space-5)" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-2xs)", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-tertiary)", marginBottom: "var(--space-3)" }}>
          Acceptance Criteria
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {ACCEPTANCE_CRITERIA.map((crit, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)", padding: "var(--space-2) var(--space-3)", background: "var(--canvas)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)" }}>
              <Check size={13} strokeWidth={3} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-xs)", color: "var(--ink-secondary)", lineHeight: 1.5 }}>{crit}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Edge Case */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "var(--space-4) var(--space-5)" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-2xs)", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-tertiary)", marginBottom: "var(--space-3)" }}>
          Edge Cases
        </p>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)" }}>
          <AlertTriangle size={13} color="var(--status-warning-fg)" style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-xs)", color: "var(--ink-secondary)", lineHeight: 1.5 }}>
            Existing users with explicit light-mode choice must not be switched to system preference on upgrade.
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function WatchItWork() {
  // Detect reduced-motion once — never changes
  const prefersReduced = useRef(
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const [phase, setPhase] = useState<Phase>(prefersReduced.current ? 5 : 0);
  const [inView, setInView] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (prefersReduced.current) return;
    const el = wrapperRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const advance = useCallback(() => {
    setPhase((prev) => ((prev + 1) % 6) as Phase);
  }, []);

  useEffect(() => {
    if (prefersReduced.current || !inView) return;
    timerRef.current = setTimeout(advance, PHASE_DURATIONS[phase]);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase, inView, advance]);

  const stepStates = STEPPER_PHASES[phase];
  const thinkingLines = THINKING_LINES[phase];
  const showPrd = phase >= 4;

  return (
    <section
      id="watch-it-work"
      ref={wrapperRef}
      role="img"
      aria-label="Claire turning a feature request into a PRD"
      style={{ position: "relative", padding: "var(--space-24) var(--space-6)", borderTop: "1px solid var(--border-subtle)", overflow: "hidden" }}
    >
      <SectionWash corner="bottom-right" />
      <div style={{ maxWidth: 1080, margin: "0 auto", position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ marginBottom: "var(--space-12)" }}>
          <p className="eyebrow" style={{ marginBottom: "var(--space-4)" }}>See it think</p>
          <h2 className="display" style={{ fontSize: "clamp(1.75rem, 4vw, 2.75rem)", letterSpacing: "-0.02em", lineHeight: 1.1, color: "var(--ink)", marginBottom: "var(--space-4)", textWrap: "balance" }}>
            From one sentence to a real PRD.
          </h2>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-md)", color: "var(--ink-secondary)", lineHeight: 1.6, maxWidth: "52ch" }}>
            Claire doesn't fill a template. It reads the request, weighs the consequences, and writes the spec.
          </p>
        </div>

        {/* Two-column layout — align-items:stretch so both columns are equal height */}
        <div style={{ display: "grid", gridTemplateColumns: "55fr 45fr", gap: "var(--space-6)", alignItems: "stretch" }}>

          {/* ── LEFT: App window — FIXED height = tallest final state ─────── */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* Window chrome */}
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-subtle)", background: "var(--surface-raised)", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {["var(--status-error-fg)", "var(--status-warning-fg)", "var(--status-success-fg)"].map((c, i) => (
                  <span key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c, opacity: 0.5, display: "block" }} />
                ))}
              </div>
              <div style={{ flex: 1, background: "var(--canvas)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-base)", padding: "var(--space-1) var(--space-3)", fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--ink-tertiary)" }}>
                claire.app / requests / 1482
              </div>
              <StatusBadge
                status={phase < 4 ? "generating" : "prd ready"}
                tier={phase < 4 ? "generating" : "active"}
              />
            </div>

            {/* Scrollable inner — fixed min-height to prevent layout shift */}
            <div style={{ padding: "var(--space-5)", flex: 1, minHeight: 560 }}>
              {/* Request bar — always visible */}
              <div style={{ padding: "var(--space-3) var(--space-4)", background: "var(--canvas)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", marginBottom: "var(--space-5)", display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-2xs)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-tertiary)", flexShrink: 0 }}>Request</span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--ink)", fontWeight: 500 }}>
                  Add dark mode for the settings page
                </span>
              </div>

              {/* Stepper — always present in DOM, states animate in-place */}
              <div style={{ marginBottom: "var(--space-5)" }}>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-2xs)", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-tertiary)", marginBottom: "var(--space-3)" }}>
                  Processing
                </p>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {STEPS.map((step, i) => (
                    <StepRow key={step.id} label={step.label} state={stepStates[i]} />
                  ))}
                </div>
              </div>

              {/*
                PRD area: BOTH states live in the DOM simultaneously in a position:relative
                container. They stack via position:absolute and crossfade via opacity only.
                The container has the fixed height of the PRD state so it never shrinks.
              */}
              <div style={{ position: "relative", minHeight: 280 }}>
                {/* PRD placeholder — visible when showPrd === false */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    opacity: showPrd ? 0 : 1,
                    transition: `opacity ${CROSSFADE_MS}ms ${EXPO_CSS}`,
                    pointerEvents: showPrd ? "none" : "auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px dashed var(--border)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--ink-tertiary)" }}>
                    PRD generating…
                  </p>
                </div>

                {/* PRD cards — visible when showPrd === true */}
                <div
                  style={{
                    opacity: showPrd ? 1 : 0,
                    transition: `opacity ${CROSSFADE_MS}ms ${EXPO_CSS}`,
                    pointerEvents: showPrd ? "auto" : "none",
                  }}
                >
                  <PrdCards />
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Thinking panel — fills same height via stretch ──────── */}
          <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border-subtle)", borderRadius: 16, padding: "var(--space-5)", display: "flex", flexDirection: "column" }}>
            {/* Panel header */}
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-5)", paddingBottom: "var(--space-4)", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: phase < 5 ? "var(--accent)" : "var(--status-success-fg)", display: "block", flexShrink: 0 }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", fontWeight: 500, color: "var(--ink-secondary)" }}>
                {phase < 5 ? "Thinking…" : "Done."}
              </span>
            </div>

            {/* Thinking lines */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", flex: 1 }}>
              {thinkingLines.map((line, i) => {
                const isActive = i === thinkingLines.length - 1 && phase < 5;
                return (
                  <p
                    key={line}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--text-xs)",
                      lineHeight: 1.6,
                      color: isActive ? "var(--ink)" : "var(--ink-secondary)",
                      margin: 0,
                      opacity: 1,
                      // Lines fade in by using a CSS animation keyed on their index
                      animation: prefersReduced.current ? "none" : `fadeIn 220ms ${EXPO_CSS}`,
                    }}
                  >
                    {line}
                  </p>
                );
              })}
              {thinkingLines.length === 0 && (
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--ink-tertiary)", margin: 0 }}>
                  Reading the request…
                </p>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* keyframe for thinking line fade-in — tiny, no layout impact */}
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </section>
  );
}
