"use client";

import { useEffect, useRef } from "react";
import { PipelineAnimation } from "./PipelineAnimation";

function Reveal({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Default visible so content never gates on animation
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    el.style.opacity = "0";
    el.style.transform = "translateY(12px)";
    el.style.transition = `opacity 320ms var(--ease-out-expo) ${delay}ms, transform 320ms var(--ease-out-expo) ${delay}ms`;

    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [delay]);

  return (
    <div ref={ref} style={style}>
      {children}
    </div>
  );
}

export function Hero() {
  return (
    <section
      style={{
        padding: "var(--space-24) var(--space-6) var(--space-20)",
        maxWidth: 1120,
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      {/* Eyebrow */}
      <Reveal delay={0}>
        <p
          className="eyebrow"
          style={{ marginBottom: "var(--space-6)" }}
        >
          AI-driven feature pipeline
        </p>
      </Reveal>

      {/* h1 — Fraunces display class required after T1 */}
      <Reveal delay={60}>
        <h1
          className="display"
          style={{
            fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            textWrap: "balance",
            marginBottom: "var(--space-6)",
            color: "var(--ink)",
          }}
        >
          <span style={{ color: "var(--accent)" }}>Ship</span> features.{" "}
          Skip the chaos.
        </h1>
      </Reveal>

      {/* Sub */}
      <Reveal delay={120}>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-lg)",
            color: "var(--ink-secondary)",
            maxWidth: "52ch",
            margin: "0 auto var(--space-10)",
            lineHeight: 1.6,
          }}
        >
          Claire takes a raw request through a pipeline that writes the PRD,
          plans the tasks, and reviews the code against what you actually asked
          for. You stay the final yes.
        </p>
      </Reveal>

      {/* CTAs */}
      <Reveal delay={180}>
        <div
          style={{
            display: "flex",
            gap: "var(--space-4)",
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: "var(--space-16)",
          }}
        >
          <a
            href="/api/demo-login"
            className="btn btn-primary"
            style={{
              fontSize: "var(--text-base)",
              padding: "var(--space-3) var(--space-6)",
              borderRadius: "var(--radius-pill)",
              color: "#ffffff",
              transition:
                "background 120ms var(--ease-out-quart), transform 120ms var(--ease-out-quart)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
            }}
          >
            Try the demo →
          </a>
          <a
            href="#how-it-works"
            className="btn btn-ghost"
            style={{
              fontSize: "var(--text-base)",
              padding: "var(--space-3) var(--space-6)",
              color: "var(--ink-secondary)",
            }}
          >
            See how it works
          </a>
        </div>
      </Reveal>

      {/* Pipeline */}
      <Reveal delay={260} style={{ width: "100%" }}>
        <PipelineAnimation />
      </Reveal>
    </section>
  );
}
