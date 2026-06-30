"use client";

import { useEffect, useRef, useState } from "react";

function CountUp({ target, duration = 600 }: { target: number; duration?: number }) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      setValue(target);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            // ease-out cubic
            const ease = 1 - Math.pow(1 - t, 3);
            setValue(Math.round(ease * target));
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return <span ref={ref}>{value}</span>;
}

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = "1";

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    el.style.opacity = "0";
    el.style.transition = `opacity 320ms var(--ease-out-expo) ${delay}ms`;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = "1";
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return <div ref={ref}>{children}</div>;
}

export function StatsStrip({
  timeToShipDays,
}: {
  timeToShipDays: number | null;
}) {
  const stats = [
    { value: 8, label: "pipeline stages", animate: false },
    { value: 1, label: "human approval gate", animate: false },
    ...(timeToShipDays != null
      ? [{ value: timeToShipDays, label: "avg days to ship", animate: true }]
      : []),
  ];

  return (
    <section
      style={{
        padding: "var(--space-16) var(--space-6)",
        borderTop: "1px solid var(--border-subtle)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div
        style={{
          maxWidth: 860,
          margin: "0 auto",
          display: "flex",
          gap: "var(--space-12)",
          justifyContent: "center",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {stats.map((stat, i) => (
          <FadeIn key={stat.label} delay={i * 80}>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "clamp(2rem, 4vw, 3rem)",
                  fontWeight: 500,
                  color: "var(--ink)",
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                  marginBottom: "var(--space-2)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {stat.animate ? (
                  <CountUp target={stat.value} />
                ) : (
                  stat.value
                )}
              </div>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-sm)",
                  color: "var(--ink-tertiary)",
                  margin: 0,
                }}
              >
                {stat.label}
              </p>
            </div>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}
