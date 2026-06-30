"use client";

import * as React from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { SkeletonList, EmptyState, StatusBadge } from "@claire/ui";
import { FileText, GitPullRequest, AlertCircle, Minus, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

function IssuePills({
  issues,
}: {
  issues: { severity: string }[];
}) {
  const blocking = issues.filter((i) => i.severity === "BLOCKING").length;
  const nonBlocking = issues.filter((i) => i.severity === "NON_BLOCKING").length;
  const suggestions = issues.filter((i) => i.severity === "SUGGESTION").length;

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {blocking > 0 && (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[10px] font-medium"
          style={{
            backgroundColor: "var(--status-error-bg)",
            color: "var(--status-error-fg)",
            border: "1px solid var(--status-error-border)",
          }}
          title={`${blocking} blocking issue${blocking !== 1 ? "s" : ""}`}
        >
          <AlertCircle size={10} />
          {blocking}
        </span>
      )}
      {nonBlocking > 0 && (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[10px] font-medium"
          style={{
            backgroundColor: "var(--status-warning-bg)",
            color: "var(--status-warning-fg)",
            border: "1px solid var(--status-warning-border)",
          }}
          title={`${nonBlocking} non-blocking issue${nonBlocking !== 1 ? "s" : ""}`}
        >
          <Minus size={10} />
          {nonBlocking}
        </span>
      )}
      {suggestions > 0 && (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[10px] font-medium"
          style={{
            backgroundColor: "var(--status-neutral-bg)",
            color: "var(--status-neutral-fg)",
            border: "1px solid var(--status-neutral-border)",
          }}
          title={`${suggestions} suggestion${suggestions !== 1 ? "s" : ""}`}
        >
          {suggestions}
        </span>
      )}
    </div>
  );
}

export default function ReviewsPage() {
  const { data: reviews, isLoading } = trpc.review.listAll.useQuery();

  return (
    <div style={{ maxWidth: 800 }} className="mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="border-b pb-6" style={{ borderColor: "var(--border-subtle)" }}>
        <h1
          className="font-display font-medium text-ink mb-1"
          style={{ fontSize: "var(--text-2xl)", letterSpacing: "var(--tracking-tighter)" }}
        >
          Reviews
        </h1>
        <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>
          AI code reviews across your connected repositories.
        </p>
      </div>

      {/* List */}
      {isLoading ? (
        <SkeletonList count={5} />
      ) : !reviews || reviews.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No AI code reviews yet. Open a pull request on a connected repository to trigger your first review."
          actionLabel="Connect a repository"
          onAction={() => (window.location.href = "/settings/github")}
        />
      ) : (
        <div
          className="rounded-lg overflow-hidden"
          style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
        >
          {reviews.map((review, idx) => {
            const pr = review.pullRequest;
            const repo = (pr as any)?.repository;
            const passed = review.passed;
            const issues = review.issues ?? [];

            return (
              <Link
                key={review.id}
                href={`/reviews/${review.id}`}
                className="flex items-center gap-4 px-4 py-3 transition-colors group"
                style={{
                  borderTop: idx === 0 ? "none" : `1px solid var(--border-subtle)`,
                  textDecoration: "none",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "var(--surface-overlay)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                {/* Icon */}
                <span style={{ color: "var(--ink-tertiary)", flexShrink: 0 }}>
                  <GitPullRequest size={15} />
                </span>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <p
                    className="font-medium text-sm truncate"
                    style={{ color: "var(--ink)" }}
                  >
                    {pr?.title ?? "Untitled PR"}
                  </p>
                  <p
                    className="text-xs mt-0.5 font-mono"
                    style={{ color: "var(--ink-tertiary)" }}
                  >
                    {repo?.fullName ?? repo?.name ?? "—"}
                    {pr?.authorLogin ? ` · ${pr.authorLogin}` : ""}
                    {review.reviewNumber && review.reviewNumber > 1
                      ? ` · Review #${review.reviewNumber}`
                      : ""}
                  </p>
                </div>

                {/* Issue pills */}
                <IssuePills issues={issues} />

                {/* Pass/fail badge */}
                <StatusBadge
                  status={passed ? "Passed" : "Needs changes"}
                  tier={passed ? "success" : "error"}
                />

                {/* Chevron */}
                <span
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: "var(--ink-tertiary)", flexShrink: 0 }}
                >
                  <ChevronRight size={14} />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
