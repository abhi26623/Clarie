"use client";

import { useEffect, useRef } from "react";

const STEPS = [
  "Someone asks for a feature. In plain words, from anywhere.",
  "Claire writes the PRD — problem, goals, acceptance criteria, edge cases.",
  "The PRD becomes real tasks on a board.",
  "Your team (or an agent) writes the code and opens a PR.",
  "AI reviews the PR against the PRD — not the syntax, the intent.",
  "Issues go back as fixes. The review runs again. And again, until it holds.",
  "A human approves the plan. Nothing ships without you.",
  "Shipped — with the whole trail behind it.",
];

function StepItem({ step, index, total }: { step: string; index: number; total: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    el.style.opacity = "0";
    el.style.transform = "translateY(10px)";
    el.style.transition = "opacity 300ms var(--ease-out-expo), transform 300ms var(--ease-out-expo)";

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
          observer.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -8% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isLoop = index === 5; // "Issues go back…"

  return (
    <div
      ref={ref}
      style={{
        display: "flex",
        gap: "var(--space-6)",
        alignItems: "flex-start",
        position: "relative",
      }}
    >
      {/* Rail dot */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 28 }}>
        <div
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: isLoop ? "var(--status-warning-fg)" : "var(--accent)",
            border: `1px solid ${isLoop ? "var(--status-warning-border)" : "var(--accent)"}`,
            marginTop: 5,
            flexShrink: 0,
            zIndex: 1,
          }}
        />
      </div>

      {/* Content */}
      <div style={{ paddingBottom: index < total - 1 ? "var(--space-8)" : 0, flex: 1 }}>
        {/* Step number */}
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-2xs)",
            color: "var(--ink-tertiary)",
            letterSpacing: "0.06em",
            display: "block",
            marginBottom: "var(--space-1)",
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-md)",
            color: isLoop ? "var(--status-warning-fg)" : "var(--ink-secondary)",
            lineHeight: 1.55,
            maxWidth: "54ch",
            margin: 0,
            fontWeight: isLoop ? 500 : 400,
          }}
        >
          {step}
        </p>
        {isLoop && (
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-sm)",
              color: "var(--ink-tertiary)",
              marginTop: "var(--space-1)",
            }}
          >
            ↩ loops back through AI review
          </p>
        )}
      </div>
    </div>
  );
}

export function HowItWorks() {
  const railRef = useRef<HTMLDivElement>(null);

  // Dot descends on scroll
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    const dot = rail.querySelector<HTMLElement>(".rail-dot");
    if (!dot) return;

    const onScroll = () => {
      const rect = rail.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, -rect.top / (rect.height - window.innerHeight * 0.5)));
      dot.style.top = `${progress * 100}%`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section
      id="how-it-works"
      style={{
        padding: "var(--space-24) var(--space-6)",
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "var(--space-16)" }}>
          <h2
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              fontSize: "var(--text-2xl)",
              letterSpacing: "-0.02em",
              color: "var(--ink)",
              marginBottom: "var(--space-3)",
            }}
          >
            One loop, start to ship.
          </h2>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-md)",
              color: "var(--ink-secondary)",
              maxWidth: "52ch",
              lineHeight: 1.6,
            }}
          >
            Eight stages. One review gate. You approve; Claire does the rest.
          </p>
        </div>

        {/* Steps with vertical rail */}
        <div style={{ display: "flex", gap: "var(--space-6)" }}>
          {/* Vertical rail */}
          <div
            ref={railRef}
            style={{
              position: "relative",
              flexShrink: 0,
              width: 1,
              background: "var(--border)",
              marginTop: 10,
              marginLeft: 14, // center on dot
              alignSelf: "stretch",
            }}
          >
            {/* Scrolling dot */}
            <div
              className="rail-dot"
              style={{
                position: "absolute",
                top: 0,
                left: "50%",
                transform: "translateX(-50%)",
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "var(--accent)",
                transition: "top 60ms linear",
              }}
            />
          </div>

          {/* Steps */}
          <div style={{ flex: 1 }}>
            {STEPS.map((step, i) => (
              <StepItem key={i} step={step} index={i} total={STEPS.length} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
