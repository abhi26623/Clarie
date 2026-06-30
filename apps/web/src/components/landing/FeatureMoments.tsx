"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Check } from "lucide-react";
import { StatusBadge } from "@claire/ui";
import { SectionWash } from "./SectionWash";

// ─── Constants ────────────────────────────────────────────────────────────────
// Fixed preview area height — bumped to 240 to ensure no clipping for Card 1.
// All 4 cards share this height so the grid rows stay uniform.
const PREVIEW_H = 240;
const EASE = "var(--ease-out-quart)";
const T = 120; // ms per step

// Detect if device relies on touch (no hover). We use this so mobile gets
// an on-scroll reveal, but desktop gets proper hover in/out interactions.
function useIsTouch() {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    setIsTouch(window.matchMedia("(hover: none)").matches);
  }, []);
  return isTouch;
}

// ─── Shared: fires once when element enters viewport ─────────────────────────
function useInView(threshold = 0.3) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !fired.current) {
          fired.current = true;
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, inView };
}

// ─── Card 1: PRD acceptance-criteria rows ────────────────────────────────────
const AC_ROWS = [
  "Settings respects system & user-set preferences",
  "Toggle persists across sessions via localStorage",
  "Components use CSS custom properties for theme",
];

function PrdPreview({ hovered, inView }: { hovered: boolean; inView: boolean }) {
  const isTouch = useIsTouch();
  // Desktop: trigger on hover. Mobile: trigger once on view.
  const active = hovered || (isTouch && inView);
  
  const [checks, setChecks] = useState([false, false, false]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const run = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setChecks([false, false, false]);
    AC_ROWS.forEach((_, i) => {
      const t = setTimeout(() => setChecks((p) => { const n = [...p]; n[i] = true; return n; }), T * (i + 1));
      timers.current.push(t);
    });
  }, []);

  useEffect(() => {
    if (active) run();
    if (!active) { 
      timers.current.forEach(clearTimeout); 
      setChecks([false, false, false]); 
    }
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <div style={{ height: PREVIEW_H, display: "flex", flexDirection: "column", justifyContent: "center", gap: "var(--space-2)" }}>
      {/* Label */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-2xs)", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "var(--ink-tertiary)" }}>
          Acceptance Criteria
        </span>
        <StatusBadge status="prd ready" tier="active" />
      </div>
      {AC_ROWS.map((row, i) => (
        <div
          key={i}
          style={{
            display: "flex", alignItems: "center", gap: "var(--space-2)",
            padding: "var(--space-2) var(--space-3)",
            background: checks[i] ? "var(--status-success-bg)" : "var(--canvas)",
            border: `1px solid ${checks[i] ? "var(--status-success-border)" : "var(--border-subtle)"}`,
            borderRadius: "var(--radius-sm)",
            transition: `background ${T}ms ${EASE}, border-color ${T}ms ${EASE}`,
          }}
        >
          <span style={{
            width: 14, height: 14, borderRadius: "50%",
            border: `1px solid ${checks[i] ? "var(--status-success-fg)" : "var(--border-strong)"}`,
            background: checks[i] ? "var(--status-success-fg)" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            transition: `background ${T}ms ${EASE}, border-color ${T}ms ${EASE}`,
          }}>
            {checks[i] && <Check size={8} strokeWidth={3} color="#fff" />}
          </span>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-xs)", color: checks[i] ? "var(--status-success-fg)" : "var(--ink-secondary)", lineHeight: 1.4, transition: `color ${T}ms ${EASE}` }}>
            {row}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Card 2: Mini kanban ──────────────────────────────────────────────────────
const TASKS = [
  { label: "Theme toggle",    priority: "var(--status-error-fg)" },
  { label: "CSS var audit",   priority: "var(--status-warning-fg)" },
  { label: "localStorage",    priority: "var(--accent)" },
];
const TASK_COLS_DEFAULT = [0, 1, 0];

function KanbanPreview({ hovered, inView }: { hovered: boolean; inView: boolean }) {
  const isTouch = useIsTouch();
  const active = hovered || (isTouch && inView);
  
  const [cols, setCols] = useState([...TASK_COLS_DEFAULT]);
  const [moving, setMoving] = useState<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const run = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setCols([...TASK_COLS_DEFAULT]);
    setMoving(null);
    const t1 = setTimeout(() => setMoving(0), T);
    const t2 = setTimeout(() => {
      setCols((p) => { const n = [...p]; n[0] = 1; return n; });
      setMoving(null);
    }, T * 4);
    timers.current.push(t1, t2);
  }, []);

  useEffect(() => {
    if (active) run();
    if (!active) { 
      timers.current.forEach(clearTimeout); 
      setCols([...TASK_COLS_DEFAULT]); 
      setMoving(null); 
    }
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const COLS = ["Todo", "In prog"];

  return (
    <div style={{ height: PREVIEW_H, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)", height: "100%" }}>
        {COLS.map((colLabel, colIdx) => (
          <div key={colLabel} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {/* Col header */}
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "var(--ink-tertiary)", display: "flex", alignItems: "center", gap: "var(--space-1)", flexShrink: 0 }}>
              {colLabel}
              <span style={{ background: "var(--surface-overlay)", borderRadius: "var(--radius-pill)", padding: "0 4px", fontSize: "9px", color: "var(--ink-tertiary)", fontFamily: "var(--font-mono)" }}>
                {cols.filter((c) => c === colIdx).length}
              </span>
            </div>
            {/* Task cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", flex: 1 }}>
              {TASKS.map((task, i) =>
                cols[i] === colIdx ? (
                  <div
                    key={i}
                    style={{
                      padding: "var(--space-1-5) var(--space-2)",
                      background: moving === i ? "var(--status-active-bg)" : "var(--canvas)",
                      border: `1px solid ${moving === i ? "var(--status-active-border)" : "var(--border-subtle)"}`,
                      borderRadius: "var(--radius-sm)",
                      display: "flex", alignItems: "center", gap: "var(--space-1-5)",
                      transform: moving === i ? "translateY(-2px)" : "translateY(0)",
                      transition: `background ${T}ms ${EASE}, border-color ${T}ms ${EASE}, transform ${T}ms ${EASE}`,
                      overflow: "hidden", // prevents text clipping horizontally
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: task.priority, flexShrink: 0 }} />
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "11px", color: "var(--ink-secondary)", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {task.label}
                    </span>
                  </div>
                ) : null
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Card 3: Review teaser ────────────────────────────────────────────────────
function ReviewPreview({ hovered, inView }: { hovered: boolean; inView: boolean }) {
  const isTouch = useIsTouch();
  const active = hovered || (isTouch && inView);
  
  const [confidence, setConfidence] = useState(0);
  const rafRef = useRef<number | null>(null);

  const animateTo = useCallback((target: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const from = 0;
    const dur = 480;
    function tick(now: number) {
      const t = Math.min((now - start) / dur, 1);
      const e = 1 - Math.pow(1 - t, 4);
      setConfidence(Math.round(from + (target - from) * e));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (active) animateTo(87);
    else { 
      if (rafRef.current) cancelAnimationFrame(rafRef.current); 
      setConfidence(0); 
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [active, animateTo]);

  return (
    <div style={{ height: PREVIEW_H, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as const, gap: "var(--space-2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--ink)" }}>AI review</span>
          <StatusBadge status="passed" tier="success" />
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--status-success-fg)", background: "var(--status-success-bg)", border: "1px solid var(--status-success-border)", borderRadius: "var(--radius-pill)", padding: "2px 10px", fontWeight: 500, letterSpacing: "0.02em", minWidth: "7ch", textAlign: "center" as const }}>
          {confidence}% confident
        </span>
      </div>

      {/* Verdict */}
      <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--ink-secondary)", lineHeight: 1.55, margin: 0, flex: 1, padding: "var(--space-3) 0" }}>
        Dark mode works for new accounts. Existing-user edge case flagged below.
      </p>

      {/* Blocking row */}
      <div style={{
        display: "flex", alignItems: "center", gap: "var(--space-2)",
        padding: "var(--space-2) var(--space-3)",
        background: "var(--status-error-bg)",
        border: "1px solid var(--status-error-border)",
        borderRadius: "var(--radius-sm)",
        opacity: active ? 1 : 0,
        transform: active ? "translateY(0)" : "translateY(4px)",
        transition: `opacity ${T}ms ${EASE}, transform ${T}ms ${EASE}`,
      }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-2xs)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "var(--status-error-fg)", flexShrink: 0 }}>Blocking</span>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-xs)", color: "var(--status-error-fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Missing null check on preferences</span>
      </div>
    </div>
  );
}

// ─── Card 4: Approval checklist ───────────────────────────────────────────────
const APPROVAL_ITEMS = ["PRD accepted by team", "AI review passed", "Criteria verified"];

function ApprovalPreview({ hovered, inView }: { hovered: boolean; inView: boolean }) {
  const isTouch = useIsTouch();
  const active = hovered || (isTouch && inView);
  
  const [checks, setChecks] = useState([false, false, false]);
  const [pressed, setPressed] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const run = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setChecks([false, false, false]);
    setPressed(false);
    APPROVAL_ITEMS.forEach((_, i) => {
      const t = setTimeout(() => setChecks((p) => { const n = [...p]; n[i] = true; return n; }), T * (i + 1));
      timers.current.push(t);
    });
    const tp = setTimeout(() => setPressed(true), T * (APPROVAL_ITEMS.length + 1));
    timers.current.push(tp);
  }, []);

  useEffect(() => {
    if (active) run();
    if (!active) { 
      timers.current.forEach(clearTimeout); 
      setChecks([false, false, false]); 
      setPressed(false); 
    }
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const allDone = checks.every(Boolean);

  return (
    <div style={{ height: PREVIEW_H, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      {/* Checklist */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {APPROVAL_ITEMS.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span style={{ width: 16, height: 16, borderRadius: "var(--radius-sm)", border: `1px solid ${checks[i] ? "var(--accent)" : "var(--border-strong)"}`, background: checks[i] ? "var(--accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: `background ${T}ms ${EASE}, border-color ${T}ms ${EASE}` }}>
              {checks[i] && <Check size={9} strokeWidth={3} color="#fff" />}
            </span>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: checks[i] ? "var(--ink)" : "var(--ink-tertiary)", transition: `color ${T}ms ${EASE}` }}>
              {item}
            </span>
          </div>
        ))}
      </div>

      {/* Approve pill */}
      <button
        type="button"
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)",
          padding: "var(--space-2-5) var(--space-4)",
          background: allDone ? "var(--accent)" : "var(--surface-raised)",
          border: `1px solid ${allDone ? "var(--accent)" : "var(--border)"}`,
          borderRadius: "var(--radius-pill)",
          cursor: allDone ? "pointer" : "default",
          transform: pressed ? "scale(0.98)" : "scale(1)",
          transition: `background ${T}ms ${EASE}, border-color ${T}ms ${EASE}, transform ${T}ms ${EASE}`,
        }}
      >
        <Check size={13} strokeWidth={3} color={allDone ? "#fff" : "var(--ink-tertiary)"} />
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", fontWeight: 500, color: allDone ? "#fff" : "var(--ink-tertiary)", transition: `color ${T}ms ${EASE}` }}>
          Approve &amp; ship
        </span>
      </button>
    </div>
  );
}

// ─── Card shell ───────────────────────────────────────────────────────────────
function FeatureCard({
  title, body,
  renderPreview,
}: {
  title: string;
  body: string;
  renderPreview: (hovered: boolean, inView: boolean) => React.ReactNode;
}) {
  const { ref, inView } = useInView();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={ref}
      className="card"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      style={{
        padding: "var(--space-5)",
        borderRadius: "var(--radius-xl)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-5)",
        cursor: "default",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        transition: `transform 120ms ${EASE}`,
      }}
      tabIndex={0}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      {/* Fixed-height preview zone */}
      <div
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-4)",
          // Height fixed — content never changes the card's size
          height: PREVIEW_H + 32, // +32 for padding
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {renderPreview(hovered, inView)}
      </div>

      {/* Copy */}
      <div>
        <h3 style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-base)", fontWeight: 600, color: "var(--ink)", marginBottom: "var(--space-1-5)", letterSpacing: "-0.01em", lineHeight: 1.3 }}>
          {title}
        </h3>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--ink-secondary)", lineHeight: 1.6, margin: 0 }}>
          {body}
        </p>
      </div>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────
const CARDS: {
  title: string;
  body: string;
  renderPreview: (hovered: boolean, inView: boolean) => React.ReactNode;
}[] = [
  {
    title: "PRDs that aren't vibes.",
    body: "Problem, goals, acceptance criteria, edge cases, metrics. Every time.",
    renderPreview: (h, iv) => <PrdPreview hovered={h} inView={iv} />,
  },
  {
    title: "Tasks, already broken down.",
    body: "The approved PRD becomes a board. Nobody re-types the plan.",
    renderPreview: (h, iv) => <KanbanPreview hovered={h} inView={iv} />,
  },
  {
    title: "Reviews the intent, not the indentation.",
    body: "The AI checks your PR against the PRD — not the syntax, the intent.",
    renderPreview: (h, iv) => <ReviewPreview hovered={h} inView={iv} />,
  },
  {
    title: "You're the final yes.",
    body: "Approve the plan, ship the feature. Claire never deploys behind your back.",
    renderPreview: (h, iv) => <ApprovalPreview hovered={h} inView={iv} />,
  },
];

export function FeatureMoments() {
  return (
    <section
      id="feature-moments"
      style={{ position: "relative", padding: "var(--space-24) var(--space-6)", borderTop: "1px solid var(--border-subtle)", overflow: "hidden" }}
    >
      <SectionWash corner="top-left" />
      <div style={{ maxWidth: 1060, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <h2 style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "var(--text-2xl)", letterSpacing: "-0.02em", color: "var(--ink)", marginBottom: "var(--space-12)", maxWidth: "28ch", lineHeight: 1.2 }}>
          Four things that change how features ship.
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--space-5)" }}>
          {CARDS.map((card) => (
            <FeatureCard
              key={card.title}
              title={card.title}
              body={card.body}
              renderPreview={card.renderPreview}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
