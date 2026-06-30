import { SectionWash } from "./SectionWash";

export function ClosingCta() {
  return (
    <section
      style={{
        position: "relative",
        padding: "var(--space-24) var(--space-6)",
        textAlign: "center",
        overflow: "hidden",
      }}
    >
      <SectionWash corner="top-right" />
      <div style={{ maxWidth: 640, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <h2
          className="display"
          style={{
            fontSize: "clamp(1.875rem, 4vw, 2.5rem)",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            textWrap: "balance",
            color: "var(--ink)",
            marginBottom: "var(--space-8)",
          }}
        >
          See it ship in two minutes.
        </h2>
        <a
          href="/api/demo-login"
          className="btn btn-primary"
          style={{
            fontSize: "var(--text-base)",
            padding: "var(--space-3) var(--space-8)",
            borderRadius: "var(--radius-pill)",
            color: "#ffffff",
          }}
        >
          Try the demo →
        </a>
      </div>
    </section>
  );
}

