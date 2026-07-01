"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { StatusBadge, parseDbTimestamp } from "@claire/ui";
import { toast } from "sonner";
import {
  ArrowLeft, ExternalLink, Link2, ChevronDown, ChevronUp,
  ShieldAlert, Zap, Bug, FileCode, TestTube, AlertTriangle, CheckCircle,
  GitPullRequest, Clock,
} from "lucide-react";
import { RequirementCoverageCard } from "@/components/RequirementCoverageCard";

/* ── Type icons by issue type ─────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TYPE_ICONS: Record<string, React.ComponentType<any>> = {
  REQUIREMENT_MISMATCH: AlertTriangle,
  MISSING_ACCEPTANCE: CheckCircle,
  EDGE_CASE_MISSED: AlertTriangle,
  SECURITY: ShieldAlert,
  PERFORMANCE: Zap,
  CODE_QUALITY: FileCode,
  MISSING_TESTS: TestTube,
};

/* ── Severity tier mapping ────────────────────────── */
const SEVERITY_STYLE = {
  BLOCKING: {
    bg: "var(--status-error-bg)",
    fg: "var(--status-error-fg)",
    border: "var(--status-error-border)",
    label: "Blocking",
  },
  NON_BLOCKING: {
    bg: "var(--status-warning-bg)",
    fg: "var(--status-warning-fg)",
    border: "var(--status-warning-border)",
    label: "Non-blocking",
  },
  SUGGESTION: {
    bg: "var(--status-neutral-bg)",
    fg: "var(--status-neutral-fg)",
    border: "var(--status-neutral-border)",
    label: "Suggestion",
  },
};

/* ── IssueRow ─────────────────────────────────────── */
function IssueRow({ issue }: { issue: any }) {
  const Icon = TYPE_ICONS[issue.type] ?? Bug;
  const style = SEVERITY_STYLE[issue.severity as keyof typeof SEVERITY_STYLE] ?? SEVERITY_STYLE.SUGGESTION;

  return (
    <div
      className="px-4 py-3"
      style={{ borderTop: "1px solid var(--border-subtle)" }}
    >
      <div className="flex items-start gap-3">
        {/* Type icon */}
        <span className="mt-0.5 flex-shrink-0" style={{ color: style.fg }}>
          <Icon size={14} />
        </span>

        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Title + severity badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>
              {issue.title}
            </span>
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded-full font-mono text-[10px] font-medium"
              style={{
                backgroundColor: style.bg,
                color: style.fg,
                border: `1px solid ${style.border}`,
                letterSpacing: "var(--tracking-wider)",
                textTransform: "uppercase",
              }}
            >
              {style.label}
            </span>
            {/* File + line */}
            {issue.filePath ? (
              <span
                className="font-mono text-[11px]"
                style={{ color: "var(--ink-tertiary)" }}
              >
                {issue.filePath}
                {issue.lineNumber != null ? `:${issue.lineNumber}` : ""}
              </span>
            ) : (
              <span
                className="font-mono text-[11px]"
                style={{
                  color: "var(--ink-tertiary)",
                  backgroundColor: "var(--surface-raised)",
                  padding: "1px 6px",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                PR-wide
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-sm leading-relaxed" style={{ color: "var(--ink-secondary)" }}>
            {issue.description}
          </p>

          {/* Suggestion */}
          {issue.suggestion && (
            <div
              className="text-sm rounded-md px-3 py-2"
              style={{
                backgroundColor: "var(--surface-raised)",
                color: "var(--ink-secondary)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <span className="font-medium" style={{ color: "var(--ink)" }}>Fix: </span>
              {issue.suggestion}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── IssueGroup ───────────────────────────────────── */
function IssueGroup({
  label,
  issues,
  defaultOpen,
  headerStyle,
}: {
  label: string;
  issues: any[];
  defaultOpen: boolean;
  headerStyle: { bg: string; fg: string; border: string };
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  if (issues.length === 0) return null;

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: "1px solid var(--border)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors"
        style={{
          backgroundColor: headerStyle.bg,
          textAlign: "left",
          cursor: "pointer",
          border: "none",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(0.97)")}
        onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
      >
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: headerStyle.fg }}>
            {label}
          </span>
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded-full font-mono text-[10px] font-medium"
            style={{
              backgroundColor: headerStyle.fg + "22",
              color: headerStyle.fg,
            }}
          >
            {issues.length}
          </span>
        </span>
        <span style={{ color: headerStyle.fg }}>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {/* Expand — max-height transition */}
      <div
        style={{
          maxHeight: open ? `${issues.length * 200}px` : "0",
          overflow: "hidden",
          transition: "max-height 220ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* prefers-reduced-motion: instant */}
        <style>{`@media (prefers-reduced-motion: reduce) { [data-issue-group] { transition: none !important; } }`}</style>
        <div data-issue-group="" style={{ background: "var(--surface)" }}>
          {issues.map((issue) => (
            <IssueRow key={issue.id} issue={issue} />
          ))}
        </div>
      </div>
    </div>
  );
}



/* ── History timeline ─────────────────────────────── */
function ReviewHistory({ history, currentId }: { history: any[]; currentId: number }) {
  const [expandedId, setExpandedId] = React.useState<number | null>(null);
  if (history.length <= 1) return null;

  return (
    <div className="space-y-3">
      <h2
        className="font-sans font-semibold"
        style={{ fontSize: "var(--text-lg)", color: "var(--ink)" }}
      >
        Review history
      </h2>
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
      >
        {[...history].reverse().map((rev, idx) => {
          const isCurrent = rev.id === currentId;
          const isExpanded = expandedId === rev.id;
          const blockingCount = (rev.issues ?? []).filter((i: any) => i.severity === "BLOCKING").length;
          const totalIssues = (rev.issues ?? []).length;

          return (
            <div
              key={rev.id}
              style={{ borderTop: idx === 0 ? "none" : "1px solid var(--border-subtle)" }}
            >
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : rev.id)}
                className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left"
                style={{
                  background: isCurrent ? "var(--surface-overlay)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => !isCurrent && (e.currentTarget.style.background = "var(--surface-raised)")}
                onMouseLeave={(e) => !isCurrent && (e.currentTarget.style.background = "transparent")}
              >
                {/* Review number */}
                <span
                  className="font-mono text-xs font-medium flex-shrink-0"
                  style={{
                    color: isCurrent ? "var(--accent)" : "var(--ink-tertiary)",
                    minWidth: "5rem",
                  }}
                >
                  Review #{rev.reviewNumber}
                  {isCurrent && " · current"}
                </span>

                {/* Status */}
                <StatusBadge
                  status={rev.passed ? "Passed" : "Needs changes"}
                  tier={rev.passed ? "success" : "error"}
                />

                {/* Issue counts */}
                <span className="text-xs flex-1" style={{ color: "var(--ink-secondary)" }}>
                  {totalIssues === 0
                    ? "No issues"
                    : `${totalIssues} issue${totalIssues !== 1 ? "s" : ""}${blockingCount > 0 ? ` · ${blockingCount} blocking` : ""}`}
                </span>

                {/* Timestamp */}
                <span
                  className="text-xs font-mono flex-shrink-0 hidden sm:block"
                  style={{ color: "var(--ink-tertiary)" }}
                >
                  {rev.completedAt
                    ? parseDbTimestamp(rev.completedAt)?.toLocaleDateString(undefined, { month: "short", day: "numeric" })
                    : ""}
                </span>

                <span style={{ color: "var(--ink-tertiary)", flexShrink: 0 }}>
                  {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </span>
              </button>

              {/* Expanded summary */}
              <div
                style={{
                  maxHeight: isExpanded ? "200px" : "0",
                  overflow: "hidden",
                  transition: "max-height 200ms cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              >
                {rev.summary && (
                  <p
                    className="px-4 pb-3 text-sm leading-relaxed"
                    style={{ color: "var(--ink-secondary)", borderTop: "1px solid var(--border-subtle)" }}
                  >
                    {rev.summary}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Confidence meter ─────────────────────────────── */
function ConfidenceMeter({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm" style={{ color: "var(--ink-secondary)", flexShrink: 0 }}>
        Confidence
      </span>
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{ height: 6, background: "var(--surface-raised)", maxWidth: 120 }}
      >
        <div
          style={{
            width: `${value}%`,
            height: "100%",
            background: value >= 70 ? "var(--status-success-fg)" : value >= 40 ? "var(--status-warning-fg)" : "var(--status-error-fg)",
            borderRadius: "9999px",
            transition: "width 400ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </div>
      <span
        className="font-mono text-sm font-medium flex-shrink-0"
        style={{ color: "var(--ink)", minWidth: "2.5rem" }}
      >
        {value}%
      </span>
    </div>
  );
}

/* ── Main page ────────────────────────────────────── */
export default function ReviewDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id, 10);

  const { data, isLoading, error } = trpc.review.getById.useQuery(
    { id },
    { enabled: !isNaN(id) },
  );

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied");
  };

  if (isLoading) {
    return (
      <div style={{ maxWidth: 800 }} className="mx-auto py-8 space-y-4">
        {[160, 300, 200].map((h, i) => (
          <div
            key={i}
            className="rounded-lg skeleton"
            style={{ height: h, background: "var(--surface-raised)" }}
          />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ maxWidth: 800 }} className="mx-auto py-8">
        <p className="text-sm" style={{ color: "var(--status-error-fg)" }}>
          Review not found.
        </p>
      </div>
    );
  }

  const pr = data.pullRequest;
  const issues = data.issues ?? [];
  const history = data.history ?? [];

  const blocking = issues.filter((i) => i.severity === "BLOCKING");
  const nonBlocking = issues.filter((i) => i.severity === "NON_BLOCKING");
  const suggestions = issues.filter((i) => i.severity === "SUGGESTION");

  return (
    <div style={{ maxWidth: 800 }} className="mx-auto py-8 space-y-8">

      {/* Top nav */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link
          href="/reviews"
          className="flex items-center gap-1.5 text-sm font-medium transition-colors"
          style={{ color: "var(--ink-secondary)", textDecoration: "none" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-secondary)")}
        >
          <ArrowLeft size={14} /> Reviews
        </Link>

        <div className="flex items-center gap-2">
          {pr?.githubUrl && (
            <a
              href={pr.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary flex items-center gap-1.5"
              style={{ fontSize: "var(--text-sm)", padding: "6px 14px" }}
            >
              <ExternalLink size={13} /> View on GitHub
            </a>
          )}
          <button
            type="button"
            onClick={handleCopyLink}
            className="btn btn-secondary flex items-center gap-1.5"
            style={{ fontSize: "var(--text-sm)", padding: "6px 14px" }}
          >
            <Link2 size={13} /> Copy link
          </button>
        </div>
      </div>

      {/* ReviewCard */}
      <div
        className="rounded-lg p-5 space-y-4"
        style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
      >
        {/* PR title + meta */}
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <GitPullRequest size={15} style={{ color: "var(--ink-tertiary)", flexShrink: 0 }} />
            <h1
              className="font-sans font-semibold"
              style={{ fontSize: "var(--text-lg)", color: "var(--ink)", margin: 0 }}
            >
              {pr?.title ?? "Pull request"}
            </h1>
          </div>
          <p className="text-xs font-mono" style={{ color: "var(--ink-tertiary)" }}>
            {(pr as any)?.repository?.fullName ?? ""}
            {pr?.authorLogin ? ` · ${pr.authorLogin}` : ""}
            {data.reviewNumber && data.reviewNumber > 1 ? ` · Review #${data.reviewNumber}` : ""}
          </p>
        </div>

        <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-4)" }} className="space-y-3">
          {/* Result */}
          <div className="flex items-center gap-3">
            <StatusBadge
              status={data.passed ? "Passed" : "Needs changes"}
              tier={data.passed ? "success" : "error"}
            />
          </div>

          {/* Confidence */}
          {data.confidence != null && <ConfidenceMeter value={data.confidence} />}

          {/* Summary */}
          {data.summary && (
            <p className="text-sm leading-relaxed" style={{ color: "var(--ink-secondary)", maxWidth: "65ch" }}>
              {data.summary}
            </p>
          )}
        </div>
      </div>

      {/* Requirement Coverage */}
      <RequirementCoverageCard
        verdicts={data.criteriaVerdicts as any}
        prd={(data.featureRequest as any)?.prd}
        featureRequestId={data.featureRequest?.id}
      />

      {/* Issues — grouped by severity */}
      {issues.length > 0 ? (
        <div className="space-y-3">
          <h2
            className="font-sans font-semibold"
            style={{ fontSize: "var(--text-lg)", color: "var(--ink)" }}
          >
            Issues
          </h2>
          <IssueGroup
            label="Blocking"
            issues={blocking}
            defaultOpen={true}
            headerStyle={{ bg: "var(--status-error-bg)", fg: "var(--status-error-fg)", border: "var(--status-error-border)" }}
          />
          <IssueGroup
            label="Non-blocking"
            issues={nonBlocking}
            defaultOpen={false}
            headerStyle={{ bg: "var(--status-warning-bg)", fg: "var(--status-warning-fg)", border: "var(--status-warning-border)" }}
          />
          <IssueGroup
            label="Suggestions"
            issues={suggestions}
            defaultOpen={false}
            headerStyle={{ bg: "var(--status-neutral-bg)", fg: "var(--status-neutral-fg)", border: "var(--status-neutral-border)" }}
          />
        </div>
      ) : (
        <div
          className="rounded-lg px-5 py-4 text-sm"
          style={{
            border: "1px solid var(--status-success-border)",
            background: "var(--status-success-bg)",
            color: "var(--status-success-fg)",
          }}
        >
          No issues found. The code looks good.
        </div>
      )}

      {/* Review history */}
      <ReviewHistory history={history} currentId={data.id} />
    </div>
  );
}
