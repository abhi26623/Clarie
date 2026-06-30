"use client";

import { useEffect, useRef, useState } from "react";
import { StatusBadge } from "@claire/ui";

function InViewReveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = "1";

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    el.style.transition = `opacity 280ms var(--ease-out-expo) ${delay}ms, transform 280ms var(--ease-out-expo) ${delay}ms`;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -5% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return <div ref={ref}>{children}</div>;
}

export function ReviewCard() {
  const [suggestionOpen, setSuggestionOpen] = useState(false);

  return (
    <section
      id="review-card"
      style={{
        padding: "var(--space-24) var(--space-6)",
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <InViewReveal delay={0}>
          <p className="eyebrow" style={{ marginBottom: "var(--space-4)" }}>
            AI code review
          </p>
          <h2
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              fontSize: "var(--text-xl)",
              letterSpacing: "-0.02em",
              color: "var(--ink)",
              marginBottom: "var(--space-10)",
            }}
          >
            Judges code against what you asked for.
          </h2>
        </InViewReveal>

        <InViewReveal delay={80}>
          <div
            style={{
              background: "var(--surface-raised)",
              padding: "var(--space-8) var(--space-12)",
              borderRadius: "var(--radius-none)",
            }}
          >
            {/* Card header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "var(--space-5)",
                flexWrap: "wrap",
                gap: "var(--space-3)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <span
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontWeight: 600,
                    fontSize: "var(--text-sm)",
                    color: "var(--ink)",
                  }}
                >
                  AI review
                </span>
                <StatusBadge status="passed" tier="success" />
              </div>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-sm)",
                  color: "var(--status-success-fg)",
                  background: "var(--status-success-bg)",
                  border: "1px solid var(--status-success-border)",
                  borderRadius: "var(--radius-pill)",
                  padding: "2px 10px",
                  fontWeight: 500,
                  letterSpacing: "0.02em",
                }}
              >
                87% confident
              </span>
            </div>

            {/* Summary */}
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-sm)",
                color: "var(--ink-secondary)",
                lineHeight: 1.6,
                marginBottom: "var(--space-5)",
                maxWidth: "60ch",
              }}
            >
              Dark mode works for new accounts. One issue affects existing users —
              fix it and you're clear.
            </p>

            <div
              style={{
                height: 1,
                background: "var(--border-subtle)",
                marginBottom: "var(--space-5)",
              }}
            />

            {/* Blocking issue */}
            <div
              style={{
                background: "var(--status-error-bg)",
                border: "1px solid var(--status-error-border)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-4)",
                marginBottom: "var(--space-4)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  marginBottom: "var(--space-2)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "var(--text-2xs)",
                    fontWeight: 600,
                    color: "var(--status-error-fg)",
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                  }}
                >
                  Blocking
                </span>
              </div>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontWeight: 500,
                  fontSize: "var(--text-sm)",
                  color: "var(--status-error-fg)",
                  marginBottom: "var(--space-1-5)",
                }}
              >
                Missing null check on user preferences
              </p>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-sm)",
                  color: "var(--ink-secondary)",
                  marginBottom: "var(--space-3)",
                }}
              >
                Older accounts crash when toggling dark mode.
              </p>
              <code
                style={{
                  display: "block",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-xs)",
                  color: "var(--status-error-fg)",
                  background: "var(--status-error-bg)",
                  border: "1px solid var(--status-error-border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "var(--space-2) var(--space-3)",
                  marginBottom: "var(--space-2)",
                }}
              >
                user?.preferences?.theme ?? 'light'
              </code>
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-2xs)",
                  color: "var(--ink-tertiary)",
                }}
              >
                src/components/ThemeToggle.tsx
              </p>
            </div>

            {/* Suggestion — collapsible */}
            <button
              type="button"
              onClick={() => setSuggestionOpen((o) => !o)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--surface-raised)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-3) var(--space-4)",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-sm)",
                color: "var(--ink-secondary)",
              }}
              aria-expanded={suggestionOpen}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <span
                  style={{
                    fontSize: "var(--text-2xs)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    color: "var(--ink-tertiary)",
                  }}
                >
                  Suggestion
                </span>
                <span>Consider memoizing the theme resolver</span>
              </span>
              <span
                style={{
                  transform: suggestionOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 160ms var(--ease-out-quart)",
                  lineHeight: 1,
                  color: "var(--ink-tertiary)",
                  fontSize: 12,
                }}
              >
                ▾
              </span>
            </button>

            {suggestionOpen && (
              <div
                style={{
                  marginTop: "var(--space-2)",
                  padding: "var(--space-3) var(--space-4)",
                  background: "var(--surface-raised)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-sm)",
                  color: "var(--ink-secondary)",
                  lineHeight: 1.6,
                }}
              >
                The theme resolution runs on every render. A{" "}
                <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.9em" }}>useMemo</code>{" "}
                wrapping the derive call would avoid repeated work for users who rarely switch modes.
              </div>
            )}
          </div>
        </InViewReveal>
      </div>
    </section>
  );
}
