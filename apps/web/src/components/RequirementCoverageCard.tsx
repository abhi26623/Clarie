"use client";

import * as React from "react";
import Link from "next/link";
import { StatusBadge } from "@claire/ui";
import { ChevronDown, ChevronUp } from "lucide-react";

export interface RequirementCoverageCardProps {
  verdicts?: Array<{
    criterionId: string;
    text?: string;
    verdict: "met" | "partial" | "not_met";
    evidence: string;
  }> | null;
  prd?: {
    acceptanceCriteria?: unknown;
  } | null;
  featureRequestId?: number | null;
}

export function RequirementCoverageCard({
  verdicts,
  prd,
  featureRequestId,
}: RequirementCoverageCardProps) {
  const prdCriteria: any[] = Array.isArray(prd?.acceptanceCriteria)
    ? prd.acceptanceCriteria
    : [];

  const criteriaList =
    verdicts && verdicts.length > 0
      ? verdicts.map((v) => {
          const prdAc = prdCriteria.find(
            (c: any) =>
              c.id === v.criterionId ||
              (typeof c === "string" && c === v.criterionId)
          );
          const criterionText =
            v.text ??
            prdAc?.text ??
            (typeof prdAc === "string" ? prdAc : v.criterionId);
          return {
            id: v.criterionId,
            text: criterionText,
            verdict: v.verdict,
            evidence: v.evidence,
          };
        })
      : [];

  const totalCount = criteriaList.length;
  const metCount = criteriaList.filter((c) => c.verdict === "met").length;
  const allGreen = totalCount > 0 && metCount === totalCount;
  const [open, setOpen] = React.useState(!allGreen);

  if (totalCount === 0) {
    if (!featureRequestId) return null;
    return (
      <div
        className="rounded-lg p-5 flex items-center justify-between gap-4 flex-wrap"
        style={{
          border: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        <p className="text-sm m-0" style={{ color: "var(--ink-secondary)" }}>
          No acceptance criteria defined on the PRD.
        </p>
        <Link
          href={`/requests/${featureRequestId}`}
          className="btn btn-secondary text-xs"
          style={{ padding: "6px 12px", textDecoration: "none" }}
        >
          View PRD
        </Link>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        border: "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 transition-colors text-left"
        style={{ background: "transparent", border: "none", cursor: "pointer" }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "var(--surface-raised)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = "transparent")
        }
      >
        <div className="flex items-center gap-3">
          <h2
            className="text-label font-sans font-semibold m-0"
            style={{ fontSize: "var(--text-base)", color: "var(--ink)" }}
          >
            Requirement Coverage — {metCount}/{totalCount}
          </h2>
        </div>
        <span style={{ color: "var(--ink-tertiary)" }}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid var(--border-subtle)" }}>
          {criteriaList.map((crit, idx) => {
            const badgeTier =
              crit.verdict === "met"
                ? "success"
                : crit.verdict === "partial"
                ? "warning"
                : "error";
            const badgeLabel =
              crit.verdict === "met"
                ? "Met"
                : crit.verdict === "partial"
                ? "Partial"
                : "Not Met";
            return (
              <div
                key={crit.id}
                className="px-5 py-3.5 flex flex-col gap-1.5"
                style={{
                  borderTop: idx === 0 ? "none" : "1px solid var(--border-subtle)",
                }}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span
                      className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded"
                      style={{
                        background: "var(--canvas)",
                        color: "var(--ink)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      {crit.id}
                    </span>
                    <span
                      className="text-sm font-sans font-medium"
                      style={{ color: "var(--ink)" }}
                    >
                      {crit.text}
                    </span>
                  </div>
                  <StatusBadge status={badgeLabel} tier={badgeTier} />
                </div>
                {crit.evidence && (
                  <p
                    className="text-xs font-mono m-0 pl-1"
                    style={{ color: "var(--ink-tertiary)" }}
                  >
                    ↳ {crit.evidence}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
