"use client";

import React, { useState, useMemo } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@claire/api";
import { PipelineStrip, FeatureCard, SkeletonList, EmptyState } from "@claire/ui";
import { PlusCircle, FolderOpen } from "lucide-react";
import type { BadgeTier } from "@claire/ui";

// ─── Inferred type from the real tRPC router — no hand-written interfaces ────
type RouterOutputs = inferRouterOutputs<AppRouter>;
export type FeatureItem = RouterOutputs["feature"]["list"][number];

// ─── Shared stage constants (exported so both dashboard and /features page
//     can use them if they need to compute tab counts independently) ─────────
export const STATUS_BUCKETS: Record<string, string[]> = {
  all:       [],
  discovery: ["received", "analyzing", "clarification_needed", "accepted", "duplicate", "feature_exists", "bug_report", "out_of_scope", "failed"],
  planning:  ["prd_generating", "prd_ready", "tasks_generating", "tasks_ready"],
  building:  ["in_development", "fix_needed"],
  reviewing: ["in_review"],
  approval:  ["ready_for_approval", "rejected"],
  shipped:   ["shipped"],
};

export const STAGE_LABELS: Record<string, string> = {
  all:       "All",
  discovery: "Discovery",
  planning:  "Planning",
  building:  "Building",
  reviewing: "Reviewing",
  approval:  "Approval",
  shipped:   "Shipped",
};

export function getStatusTier(status: string): BadgeTier {
  switch (status) {
    case "received":
    case "analyzing":
      return "info";
    case "prd_generating":
    case "tasks_generating":
      return "generating";
    case "in_development":
    case "in_review":
    case "ready_for_approval":
      return "active";
    case "clarification_needed":
    case "fix_needed":
      return "warning";
    case "prd_ready":
    case "tasks_ready":
    case "shipped":
    case "accepted":
      return "success";
    case "duplicate":
    case "feature_exists":
    case "out_of_scope":
    case "bug_report":
    case "rejected":
      return "neutral";
    case "failed":
      return "error";
    default:
      return "neutral";
  }
}

// ─── Shared list component ───────────────────────────────────────────────────
// Manages active-stage tab state internally so both consumers (dashboard and
// /features) get the full pipeline strip + filtered card list with zero
// duplication.  The `onNewRequest` prop is optional — pass it to show the
// "+ New request" CTA in empty states (dashboard); omit it on /features.
interface FeatureListProps {
  data: FeatureItem[] | undefined;
  isLoading: boolean;
  onNewRequest?: () => void;
}

export function FeatureList({ data, isLoading, onNewRequest }: FeatureListProps) {
  const [activeStageId, setActiveStageId] = useState("all");

  // Derive tab counts — identical logic that was inline in dashboard/page.tsx
  const stages = useMemo(() => {
    const allFeatures = data || [];
    return Object.keys(STATUS_BUCKETS).map((key) => {
      const count =
        key === "all"
          ? allFeatures.length
          : allFeatures.filter((f) => STATUS_BUCKETS[key].includes(f.status)).length;
      return { id: key, label: STAGE_LABELS[key] || key, count };
    });
  }, [data]);

  // Derive filtered list — identical logic that was inline in dashboard/page.tsx
  const filteredFeatures = useMemo(() => {
    const allFeatures = data || [];
    if (activeStageId === "all") return allFeatures;
    return allFeatures.filter((f) =>
      (STATUS_BUCKETS[activeStageId] || []).includes(f.status)
    );
  }, [data, activeStageId]);

  const isPipelineEmpty = !isLoading && (!data || data.length === 0);

  return (
    <div className="space-y-6">
      {/* Pipeline strip (stage tabs with counts) */}
      <PipelineStrip
        stages={stages}
        activeStageId={activeStageId}
        onStageClick={(id) => setActiveStageId(id)}
      />

      {/* Feature card list + empty/loading states */}
      <div className="space-y-4 pt-2">
        {isLoading && <SkeletonList count={4} />}

        {isPipelineEmpty && (
          <EmptyState
            icon={PlusCircle}
            title="Your pipeline is empty. Generate your first plan."
            actionLabel={onNewRequest ? "New request" : "Get started"}
            onAction={onNewRequest}
          />
        )}

        {!isPipelineEmpty && filteredFeatures.length === 0 && (
          <EmptyState
            icon={FolderOpen}
            title="Nothing in this stage yet."
            actionLabel={onNewRequest ? "New request" : "Back to all"}
            onAction={onNewRequest}
          />
        )}

        {!isLoading &&
          filteredFeatures.map((f) => (
            <FeatureCard
              key={f.id}
              id={String(f.id)}
              title={f.title}
              submitterName={f.submitterName || "Unknown"}
              source={f.source || "Internal"}
              timestamp={f.createdAt || new Date()}
              status={f.status}
              statusTier={getStatusTier(f.status)}
              href={`/requests/${f.id}`}
            />
          ))}
      </div>
    </div>
  );
}
