import Link from "next/link";

export function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border)",
        padding: "var(--space-10) var(--space-6)",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "var(--space-6)",
        }}
      >
        {/* Wordmark + tagline */}
        <div>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              fontSize: "var(--text-sm)",
              color: "var(--ink)",
              display: "block",
              marginBottom: "var(--space-1)",
              letterSpacing: "-0.01em",
            }}
          >
            Claire
          </span>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-xs)",
              color: "var(--ink-tertiary)",
            }}
          >
            Built with the Claire pipeline.
          </span>
        </div>

        {/* Links */}
        <nav aria-label="Footer navigation">
          <ul
            style={{
              display: "flex",
              gap: "var(--space-6)",
              listStyle: "none",
              margin: 0,
              padding: 0,
            }}
          >
            {[
              { label: "Sign in", href: "/sign-in" },
              { label: "How it works", href: "#how-it-works" },
            ].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="footer-link"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "var(--text-sm)",
                    color: "var(--ink-tertiary)",
                    textDecoration: "none",
                    transition: "color 100ms var(--ease-out-quart)",
                  }}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
