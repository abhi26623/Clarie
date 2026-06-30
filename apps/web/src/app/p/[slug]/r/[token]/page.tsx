"use client";
import { trpc } from "@/lib/trpc";
import { StatusBadge } from "@claire/ui";
import Link from "next/link";
const TERMINAL = [
  "prd_ready", "tasks_generating", "tasks_ready", "in_development",
  "in_review", "fix_needed", "ready_for_approval", "shipped",
  "duplicate", "feature_exists", "bug_report", "out_of_scope",
  "accepted", "rejected", "failed"
];

const COPY_MAP: Record<string, string> = {
  received: "Claire is reading your request.",
  analyzing: "Claire is reading your request.",
  prd_generating: "Claire is reading your request.",
  clarification_needed: "The team needs one more detail.",
  prd_ready: "We have enough detail for the team to review this idea.",
  tasks_generating: "We have enough detail for the team to review this idea.",
  tasks_ready: "We have enough detail for the team to review this idea.",
  in_development: "We have enough detail for the team to review this idea.",
  in_review: "We have enough detail for the team to review this idea.",
  fix_needed: "We have enough detail for the team to review this idea.",
  ready_for_approval: "This is waiting for final approval.",
  shipped: "This request has shipped. 🎉",
  duplicate: "Your team is already working on this.",
  feature_exists: "Good news — this may already be available.",
  bug_report: "This has been logged as a bug report.",
  out_of_scope: "This falls outside the current product scope.",
  accepted: "This request has been accepted.",
  rejected: "The team could not move this forward yet.",
  failed: "The team could not move this forward yet.",
};

const TIER_MAP: Record<string, any> = {
  received: "neutral",
  analyzing: "info",
  prd_generating: "generating",
  clarification_needed: "warning",
  prd_ready: "success",
  tasks_generating: "generating",
  tasks_ready: "success",
  in_development: "active",
  in_review: "warning",
  fix_needed: "error",
  ready_for_approval: "info",
  shipped: "success",
  duplicate: "neutral",
  feature_exists: "success",
  bug_report: "warning",
  out_of_scope: "neutral",
  accepted: "success",
  rejected: "error",
  failed: "error",
};

export default function TrackingPage({ params }: { params: { slug: string; token: string } }) {
  const { slug, token } = params;

  const { data, isLoading } = trpc.feature.getPublicTracking.useQuery(
    { portalSlug: slug, trackingToken: token },
    {
      refetchInterval: (q) => {
        const row = q.state.data;
        if (!row) return 4000;
        if (TERMINAL.includes(row.status)) return false;
        if (row.status === "clarification_needed" && row.clarificationQuestion) return false;
        return 4000;
      },
    }
  );

  if (isLoading) {
    return (
      <main className="container pulse" style={{ maxWidth: 560 }}>
        <div style={{ height: 24, width: 96, backgroundColor: "var(--surface-raised)", marginBottom: 24, borderRadius: 4 }} />
        <div style={{ height: 40, width: "75%", backgroundColor: "var(--surface-raised)", marginBottom: 16, borderRadius: 4 }} />
        <div style={{ height: 32, width: 160, backgroundColor: "var(--surface-raised)", marginBottom: 32, borderRadius: 4 }} />
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ height: 48, width: "100%", backgroundColor: "var(--surface-raised)", borderRadius: 4 }} />
          <div style={{ height: 48, width: "100%", backgroundColor: "var(--surface-raised)", borderRadius: 4 }} />
          <div style={{ height: 48, width: "100%", backgroundColor: "var(--surface-raised)", borderRadius: 4 }} />
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="container" style={{ maxWidth: 560, textAlign: "center", marginTop: "10vh" }}>
        <h1 style={{ fontSize: 24, margin: "0 0 8px", fontFamily: "var(--font-display)" }}>
          This link has expired or doesn&apos;t exist.
        </h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          We couldn&apos;t find a request matching this tracking token.
        </p>
        <Link href={`/p/${slug}`} className="btn">
          Submit a new idea
        </Link>
      </main>
    );
  }

  const message = COPY_MAP[data.status] ?? "Request is being processed.";
  const tier = TIER_MAP[data.status] ?? "neutral";

  const isGenerating = ["prd_generating", "tasks_generating"].includes(data.status);
  const isTerminal = TERMINAL.includes(data.status);

  return (
    <main className="container" style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 12 }}>
        <span className="badge" style={{ backgroundColor: "var(--accent-subtle)", color: "var(--accent-text)" }}>
          {slug}
        </span>
      </div>
      
      <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2.25rem)", textWrap: "balance", margin: "0 0 12px", fontFamily: "var(--font-display)" }}>
        {data.title}
      </h1>

      {data.status === "prd_ready" && (
        <div style={{ marginBottom: 24, padding: "20px 24px", backgroundColor: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
          <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--ink)", margin: "0 0 4px", fontFamily: "var(--font-display)" }}>
            Your idea has been received
          </h2>
          <p style={{ color: "var(--ink-secondary)", fontSize: "var(--text-sm)", margin: "0 0 8px" }}>
            We have enough detail for the product team to review it.
          </p>
          <p style={{ color: "var(--ink-tertiary)", fontSize: "var(--text-xs)", margin: 0 }}>
            We’ll email you when this moves forward.
          </p>
        </div>
      )}
      
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 32 }}>
        <StatusBadge status={data.status.replace(/_/g, " ")} tier={tier} />
        <span style={{ color: "var(--ink-tertiary)", fontSize: "var(--text-sm)" }}>
          {message}
        </span>
      </div>

      <div className="card" style={{ padding: 24, display: "grid", gap: 16 }}>
        <div className="portal-step">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="portal-step--done" />
            <span>Received</span>
          </div>
          <span className="muted" style={{ fontSize: 13 }}>Done</span>
        </div>
        
        <div className="portal-step">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className={isTerminal || data.status !== "received" ? "portal-step--done" : "portal-step--running"} />
            <span>Analyzing</span>
          </div>
          <span className="muted" style={{ fontSize: 13 }}>
            {isTerminal || data.status !== "received" ? "Done" : "Working"}
          </span>
        </div>

        {(isGenerating || isTerminal || data.status === "clarification_needed") && (
          <div className="portal-step">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className={isTerminal && data.status !== "failed" && data.status !== "rejected" ? "portal-step--done" : "portal-step--running"} />
              <span>{data.status === "clarification_needed" ? "Clarification needed" : "Outcome"}</span>
            </div>
            <span className="muted" style={{ fontSize: 13 }}>
              {isTerminal && data.status !== "failed" && data.status !== "rejected" ? "Done" : "Pending"}
            </span>
          </div>
        )}
      </div>

      <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "var(--ink-tertiary)", fontSize: "var(--text-xs)" }}>
          Submitted {new Date(data.createdAt ?? "").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
        <Link href={`/p/${slug}`} className="btn" style={{ padding: "6px 12px", fontSize: 13 }}>
          Submit another idea →
        </Link>
      </div>
      <div className="portal-footer" style={{ marginTop: 40, textAlign: "center" }}>
        Powered by Claire
      </div>
    </main>
  );
}
