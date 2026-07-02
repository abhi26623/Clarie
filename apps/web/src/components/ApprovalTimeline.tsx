"use client";

import * as React from "react";
import { trpc } from "@/lib/trpc";
import { StatusBadge, BadgeTier, parseDbTimestamp } from "@claire/ui";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  History,
} from "lucide-react";

export function ApprovalTimeline({ featureId, hideHeader = false }: { featureId: number; hideHeader?: boolean }) {
  const { data: history = [], isLoading } = trpc.approval.listByFeature.useQuery(
    { featureId },
    { enabled: !!featureId }
  );
  const [expandedId, setExpandedId] = React.useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {!hideHeader && (
          <h2
            className="font-sans font-semibold"
            style={{ fontSize: "var(--text-lg)", color: "var(--ink)" }}
          >
            Approval history
          </h2>
        )}
        <div
          className="rounded-lg p-4 space-y-3"
          style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
        >
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-12 w-full rounded skeleton"
              style={{ background: "var(--surface-raised)" }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <p className="text-xs font-sans" style={{ color: "var(--ink-tertiary)" }}>
        No approval activity yet.
      </p>
    );
  }

  const total = history.length;

  return (
    <div className="space-y-3">
      {!hideHeader && (
        <h2
          className="font-sans font-semibold"
          style={{ fontSize: "var(--text-lg)", color: "var(--ink)" }}
        >
          Approval history
        </h2>
      )}
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
      >
        {history.map((item: any, idx: number) => {
          const isLatest = idx === 0;
          const isExpanded = expandedId === item.id;

          let badgeStatus = "Reviewed";
          let badgeTier: BadgeTier = "neutral";
          if (item.decision === "approved") {
            badgeStatus = "Approved";
            badgeTier = "success";
          } else if (item.decision === "needs_changes") {
            badgeStatus = "Sent back";
            badgeTier = "warning";
          } else if (item.decision === "rejected") {
            badgeStatus = "Rejected";
            badgeTier = "error";
          }

          return (
            <div
              key={item.id}
              style={{ borderTop: idx === 0 ? "none" : "1px solid var(--border-subtle)" }}
            >
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left"
                style={{
                  background: isLatest ? "var(--surface-overlay)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) =>
                  !isLatest && (e.currentTarget.style.background = "var(--surface-raised)")
                }
                onMouseLeave={(e) =>
                  !isLatest && (e.currentTarget.style.background = "transparent")
                }
              >
                {/* Decision number */}
                <span
                  className="font-mono text-xs font-medium flex-shrink-0"
                  style={{
                    color: isLatest ? "var(--accent)" : "var(--ink-tertiary)",
                    minWidth: "6.5rem",
                  }}
                >
                  Decision #{total - idx}
                  {isLatest && " · latest"}
                </span>

                {/* Status badge */}
                <StatusBadge status={badgeStatus} tier={badgeTier} />

                {/* Reviewer info */}
                <div
                  className="flex items-center gap-2 flex-1 min-w-0 text-xs truncate"
                  style={{ color: "var(--ink-secondary)" }}
                >
                  <User size={13} className="shrink-0 text-ink-tertiary" />
                  <span className="truncate font-medium text-ink">
                    {item.reviewer?.name || item.reviewer?.email || "Admin"}
                  </span>
                  {item.notes ? (
                    <span className="truncate text-ink-tertiary hidden md:inline">
                      · &ldquo;{item.notes}&rdquo;
                    </span>
                  ) : (
                    <span className="text-ink-tertiary hidden md:inline">· No notes</span>
                  )}
                </div>

                {/* Timestamp */}
                <span
                  className="text-xs font-mono flex-shrink-0 hidden sm:flex items-center gap-1"
                  style={{ color: "var(--ink-tertiary)" }}
                >
                  <Clock size={12} />
                  {item.createdAt
                    ? parseDbTimestamp(item.createdAt)?.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })
                    : ""}
                </span>

                <span style={{ color: "var(--ink-tertiary)", flexShrink: 0 }}>
                  {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </span>
              </button>

              {/* Expanded notes / reasoning */}
              <div
                style={{
                  maxHeight: isExpanded ? "400px" : "0",
                  overflow: "hidden",
                  transition: "max-height 200ms cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                <div
                  className="px-4 py-3 space-y-2 text-sm leading-relaxed"
                  style={{
                    color: "var(--ink-secondary)",
                    borderTop: "1px solid var(--border-subtle)",
                    background: "var(--surface-raised)",
                  }}
                >
                  <div className="flex items-center justify-between text-xs text-ink-tertiary font-mono">
                    <span>
                      Reviewed by{" "}
                      {item.reviewer?.name
                        ? `${item.reviewer.name} (${item.reviewer.email})`
                        : item.reviewer?.email || "Admin"}
                    </span>
                    <span>
                      {item.createdAt ? parseDbTimestamp(item.createdAt)?.toLocaleString() : ""}
                    </span>
                  </div>
                  {item.notes ? (
                    <div className="pt-1">
                      <span className="font-medium text-ink block text-xs uppercase tracking-wider mb-1">
                        Reasoning / Notes
                      </span>
                      <p className="text-ink bg-canvas p-3 rounded border border-subtle font-sans">
                        {item.notes}
                      </p>
                    </div>
                  ) : (
                    <p className="italic text-ink-tertiary text-xs pt-1">
                      No additional notes or reasoning were provided for this decision.
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
