"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Stage definitions ────────────────────────────────────────────────────────
const STAGES = [
  { id: "request",   label: "Request",   shortLabel: "Req",   tier: "neutral"    },
  { id: "prd",       label: "PRD",        shortLabel: "PRD",   tier: "generating" },
  { id: "tasks",     label: "Tasks",      shortLabel: "Tasks", tier: "active"     },
  { id: "code",      label: "Code",       shortLabel: "Code",  tier: "info"       },
  { id: "ai-review", label: "AI review",  shortLabel: "Rev",   tier: "info"       },
  { id: "fixes",     label: "Fixes",      shortLabel: "Fix",   tier: "warning"    },
  { id: "approval",  label: "Approval",   shortLabel: "App",   tier: "active"     },
  { id: "ship",      label: "Ship",       shortLabel: "Ship",  tier: "success"    },
] as const;

type StageTier = typeof STAGES[number]["tier"];

// CSS token colors per tier
const TIER_COLORS: Record<StageTier, { bg: string; fg: string; border: string }> = {
  neutral:    { bg: "var(--status-neutral-bg)",    fg: "var(--status-neutral-fg)",    border: "var(--status-neutral-border)"    },
  generating: { bg: "var(--status-generating-bg)", fg: "var(--status-generating-fg)", border: "var(--status-generating-border)" },
  active:     { bg: "var(--status-active-bg)",     fg: "var(--status-active-fg)",     border: "var(--status-active-border)"     },
  info:       { bg: "var(--status-info-bg)",       fg: "var(--status-info-fg)",       border: "var(--status-info-border)"       },
  warning:    { bg: "var(--status-warning-bg)",    fg: "var(--status-warning-fg)",    border: "var(--status-warning-border)"    },
  success:    { bg: "var(--status-success-bg)",    fg: "var(--status-success-fg)",    border: "var(--status-success-border)"    },
};

// Loop beat: token goes Fixes(5) → AI review(4) then forward again
const SEQUENCE = [0, 1, 2, 3, 4, 5, 4, 5, 6, 7] as const; // indices into STAGES
const STAGE_DWELL = 700; // ms per stage
const LOOP_PAUSE = 2200; // ms on Ship before restart

export function PipelineAnimation() {
  const [activeStage, setActiveStage] = useState(0);
  const [seqIdx, setSeqIdx] = useState(0);
  const [loopBeatDone, setLoopBeatDone] = useState(false);
  const [shipPop, setShipPop] = useState(false);
  const [hoverStage, setHoverStage] = useState<number | null>(null);
  const [isPointerFine, setIsPointerFine] = useState(false);
  const autoplayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setIsPointerFine(window.matchMedia("(pointer: fine)").matches);

    if (reducedMotion.current) {
      // Static: token rests on Ship
      setActiveStage(7);
      setLoopBeatDone(true);
      return;
    }
  }, []);

  const advance = useCallback(() => {
    setSeqIdx((prev) => {
      const next = prev + 1;
      if (next >= SEQUENCE.length) {
        // Done — pause on Ship, then restart
        setShipPop(true);
        setTimeout(() => setShipPop(false), 200);
        setTimeout(() => {
          setSeqIdx(0);
          setActiveStage(SEQUENCE[0]);
          setLoopBeatDone(false);
        }, LOOP_PAUSE);
        return prev; // freeze until reset
      }
      const stage = SEQUENCE[next];
      setActiveStage(stage);
      if (next === 6) setLoopBeatDone(true); // loop beat passed AI review second time
      return next;
    });
  }, []);

  useEffect(() => {
    if (reducedMotion.current) return;
    if (hoverStage !== null) return; // paused for hover

    autoplayRef.current = setTimeout(advance, STAGE_DWELL);
    return () => {
      if (autoplayRef.current) clearTimeout(autoplayRef.current);
    };
  }, [seqIdx, hoverStage, advance]);

  const handleStageHover = (idx: number) => {
    if (!isPointerFine || reducedMotion.current) return;
    if (autoplayRef.current) clearTimeout(autoplayRef.current);
    setHoverStage(idx);
    setActiveStage(idx);
  };

  const handleMouseLeave = () => {
    if (!isPointerFine || reducedMotion.current) return;
    setHoverStage(null);
    // autoplay resumes from current stage via useEffect
  };

  const displayStage = hoverStage !== null ? hoverStage : activeStage;

  return (
    <div
      role="img"
      aria-label="Feature pipeline: from request to ship, with a review-and-fix loop."
      style={{ width: "100%", overflowX: "auto", paddingBottom: "var(--space-8)" }}
    >
      {/* Rail container */}
      <div
        style={{
          position: "relative",
          minWidth: 560,
          maxWidth: 860,
          margin: "0 auto",
          padding: "var(--space-8) 0 var(--space-10)",
        }}
        onMouseLeave={handleMouseLeave}
      >
        {/* Horizontal rail line */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "calc(var(--space-8) + 14px)", // center on node
            left: "6.25%",
            right: "6.25%",
            height: 1,
            background: "var(--border)",
          }}
        />

        {/* Loop-back arc between AI review (4) and Fixes (5) */}
        <svg
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "calc(var(--space-8) + 28px)",
            left: 0,
            right: 0,
            width: "100%",
            height: 56,
            overflow: "visible",
          }}
          viewBox="0 0 860 56"
          preserveAspectRatio="none"
        >
          {/* Loop arc path — arc from Fixes back to AI review */}
          <path
            d={(() => {
              const n = STAGES.length;
              const xOf = (i: number) => ((i + 0.5) / n) * 860;
              const x4 = xOf(4); // AI review
              const x5 = xOf(5); // Fixes
              return `M ${x5} 14 Q ${(x4 + x5) / 2} 56, ${x4} 14`;
            })()}
            stroke="var(--status-warning-border)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            fill="none"
            opacity={0.7}
          />
          {/* Arrowhead pointing up at AI review end */}
          <polygon
            points={(() => {
              const n = STAGES.length;
              const xOf = (i: number) => ((i + 0.5) / n) * 860;
              const x4 = xOf(4);
              return `${x4},14 ${x4 - 4},22 ${x4 + 4},22`;
            })()}
            fill="var(--status-warning-border)"
            opacity={0.7}
          />
        </svg>

        {/* Stages */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            position: "relative",
          }}
        >
          {STAGES.map((stage, idx) => {
            const isActive = displayStage === idx;
            const isPast = idx < displayStage && !(idx === 4 && !loopBeatDone && displayStage > 4);
            const colors = TIER_COLORS[stage.tier];

            return (
              <div
                key={stage.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  cursor: isPointerFine ? "pointer" : "default",
                  flex: 1,
                }}
                onMouseEnter={() => handleStageHover(idx)}
              >
                {/* Node */}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    border: `1px solid ${isActive ? colors.border : "var(--border)"}`,
                    background: isActive
                      ? colors.bg
                      : isPast
                      ? "var(--surface-raised)"
                      : "var(--canvas)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background 200ms var(--ease-out-quart), border-color 200ms var(--ease-out-quart)",
                    transform: isActive && stage.id === "ship" && shipPop
                      ? "scale(1.06)"
                      : "scale(1)",
                    transitionProperty: "background, border-color, transform",
                  }}
                >
                  {/* Token dot */}
                  {isActive && (
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: colors.fg,
                      }}
                    />
                  )}
                  {!isActive && isPast && (
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--border-strong)",
                        opacity: 0.5,
                      }}
                    />
                  )}
                </div>

                {/* Label — full on desktop, short-form on mobile via className */}
                <span
                  className="pipeline-label"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "var(--text-xs)",
                    color: isActive ? colors.fg : "var(--ink-tertiary)",
                    transition: "color 200ms var(--ease-out-quart)",
                    whiteSpace: "nowrap",
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  <span className="pipeline-label-full">{stage.label}</span>
                  <span className="pipeline-label-short" style={{ display: "none" }}>
                    {stage.shortLabel}
                  </span>
                </span>

                {/* Active tier badge on current stage */}
                {isActive && (
                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "var(--text-2xs)",
                      color: colors.fg,
                      background: colors.bg,
                      border: `1px solid ${colors.border}`,
                      borderRadius: "var(--radius-pill)",
                      padding: "1px 6px",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      fontWeight: 500,
                    }}
                  >
                    {stage.tier}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Current stage description */}
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-xs)",
            color: "var(--ink-tertiary)",
            textAlign: "center",
            marginTop: "var(--space-4)",
            minHeight: "1.5em",
            transition: "opacity 150ms",
          }}
        >
          {hoverStage !== null
            ? `Hover: ${STAGES[hoverStage].label}`
            : displayStage === 4 && !loopBeatDone
            ? "Reviewing code against the PRD…"
            : displayStage === 5 && !loopBeatDone
            ? "Issues found — sending back for fixes"
            : displayStage === 4 && loopBeatDone
            ? "Re-reviewing after fixes"
            : displayStage === 7
            ? "Shipped with the full trail behind it"
            : null}
        </p>
      </div>
    </div>
  );
}
