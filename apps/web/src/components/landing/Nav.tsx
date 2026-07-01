"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className="landing-nav"
      style={{
        position: "sticky",
        top: 0,
        zIndex: "var(--z-sticky)",
        background: "var(--canvas)",
        borderBottom: scrolled
          ? "1px solid var(--border)"
          : "1px solid transparent",
        transition: "border-color 160ms var(--ease-out-quart)",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "0 var(--space-6)",
          height: 88,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-8)",
        }}
      >
        {/* Wordmark */}
        <Link href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
          <img src="/icon.png" alt="Claire Logo" style={{ height: 72, width: "auto", objectFit: "contain" }} />
        </Link>

        {/* Center nav links */}
        <div className="landing-nav-links" style={{ display: "flex", gap: "var(--space-8)", alignItems: "center" }}>
          {[
            { label: "Product", href: "#feature-moments" },
            { label: "How it works", href: "#how-it-works" },
            { label: "See a review", href: "#review-card" },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-sm)",
                color: "var(--ink-secondary)",
                textDecoration: "none",
                letterSpacing: "0",
                transition: "color 100ms var(--ease-out-quart)",
              }}
              onMouseEnter={(e) =>
                ((e.target as HTMLElement).style.color = "var(--ink)")
              }
              onMouseLeave={(e) =>
                ((e.target as HTMLElement).style.color = "var(--ink-secondary)")
              }
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* CTAs */}
        <div className="landing-nav-ctas" style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
          <Link
            href="/sign-in"
            className="btn btn-ghost"
            style={{ fontSize: "var(--text-sm)", padding: "var(--space-2) var(--space-3)" }}
          >
            Sign in
          </Link>
          <a
            href="/api/demo-login"
            className="btn btn-primary"
            style={{
              fontSize: "var(--text-sm)",
              padding: "var(--space-2) var(--space-4)",
              borderRadius: "var(--radius-pill)",
            }}
          >
            Try the demo →
          </a>
        </div>

        {/* Mobile hamburger placeholder — shows on mobile */}
        <div className="landing-nav-hamburger" style={{ display: "none", alignItems: "center", gap: "var(--space-3)" }}>
          <a
            href="/api/demo-login"
            className="btn btn-primary"
            style={{ fontSize: "var(--text-sm)", borderRadius: "var(--radius-pill)" }}
          >
            Try the demo →
          </a>
        </div>
      </div>
    </nav>
  );
}
