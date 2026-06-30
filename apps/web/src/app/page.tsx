import type { Metadata } from "next";

export const dynamic = "force-dynamic";

import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { WatchItWork } from "@/components/landing/WatchItWork";
import { ReviewCard } from "@/components/landing/ReviewCard";
import { FeatureMoments } from "@/components/landing/FeatureMoments";
import { StatsStrip } from "@/components/landing/StatsStrip";
import { ClosingCta } from "@/components/landing/ClosingCta";
import { Footer } from "@/components/landing/Footer";
import { db } from "@claire/db";
import { featureRequests } from "@claire/db";
import { eq, avg } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Claire — Ship features. Skip the chaos.",
  description:
    "AI-reviewed, PRD-driven feature pipeline. Idea to production through one loop.",
  openGraph: {
    title: "Claire — Ship features. Skip the chaos.",
    description:
      "AI-reviewed, PRD-driven feature pipeline. Idea to production through one loop.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Claire — Ship features. Skip the chaos.",
    description:
      "AI-reviewed, PRD-driven feature pipeline. Idea to production through one loop.",
  },
};

export default async function LandingPage() {
  // Fetch avg time-to-ship — omit stat if null
  let timeToShipDays: number | null = null;
  try {
    const [result] = await db
      .select({ avg: avg(featureRequests.timeToShipDays) })
      .from(featureRequests)
      .where(eq(featureRequests.status, "shipped"));
    const raw = result?.avg;
    if (raw != null) {
      timeToShipDays = Math.round(Number(raw));
    }
  } catch {
    // DB unavailable at build time — omit stat silently
  }

  return (
    <>
      {/* Grain overlay — z-index: -1 so it sits below all content */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -1,
          pointerEvents: "none",
          opacity: 0.028,
        }}
      >
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <filter id="grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      </div>

      <header>
        <Nav />
      </header>

      <main>
        <Hero />
        <HowItWorks />
        <WatchItWork />
        <ReviewCard />

        {/* Breathing beat */}
        <div style={{ paddingBlock: "var(--space-20)", textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--ink-secondary)" }}>
            It doesn't stop at code review.
          </p>
        </div>

        <FeatureMoments />
        <StatsStrip timeToShipDays={timeToShipDays} />
        <ClosingCta />
      </main>

      <Footer />
    </>
  );
}
