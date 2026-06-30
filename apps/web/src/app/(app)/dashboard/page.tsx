"use client";
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useSession, signOut } from "@claire/auth/client";
import { PipelineStrip, FeatureCard, SkeletonList, EmptyState } from "@claire/ui";
import { NewRequestSlideOver } from "@/components/NewRequestSlideOver";
import { Plus, FolderOpen, PlusCircle } from "lucide-react";
import { BadgeTier } from "@claire/ui";

// Co-located skeleton — matches the real header + pipeline strip + 4 feature cards
function DashboardSkeleton() {
  return (
    <main className="container space-y-8 py-10">
      {/* Header row */}
      <div className="flex items-center justify-between border-b border-subtle pb-6">
        <div className="space-y-2">
          <div className="skeleton h-8 w-40 rounded" />
          <div className="skeleton h-3.5 w-56 rounded" />
        </div>
        <div className="skeleton h-9 w-32 rounded-md" />
      </div>
      {/* Pipeline strip */}
      <div className="flex items-center gap-4 border-b border-subtle pb-1">
        {[80, 72, 68, 76, 64, 60].map((w, i) => (
          <div key={i} className="skeleton rounded-full" style={{ height: 24, width: w }} />
        ))}
      </div>
      {/* Feature card rows */}
      <SkeletonList count={4} />
    </main>
  );
}

const STATUS_BUCKETS: Record<string, string[]> = {
  all: [], // special case: includes everything
  discovery: ["received", "analyzing", "clarification_needed", "accepted", "duplicate", "feature_exists", "bug_report", "out_of_scope", "failed"],
  planning: ["prd_generating", "prd_ready", "tasks_generating", "tasks_ready"],
  building: ["in_development", "fix_needed"],
  reviewing: ["in_review"],
  approval: ["ready_for_approval", "rejected"],
  shipped: ["shipped"],
};

const STAGE_LABELS: Record<string, string> = {
  all: "All",
  discovery: "Discovery",
  planning: "Planning",
  building: "Building",
  reviewing: "Reviewing",
  approval: "Approval",
  shipped: "Shipped",
};

function getStatusTier(status: string): BadgeTier {
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

export default function Dashboard() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const { data, isLoading: dataLoading, error: dataError, refetch } = trpc.feature.list.useQuery();
  
  // Self-heal workspace settings
  trpc.organization.ensureSettings.useQuery(undefined, {
    enabled: !!session?.session?.activeOrganizationId,
  });

  const [activeStageId, setActiveStageId] = useState("all");
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);

  const isLoading = sessionLoading || dataLoading;

  // Keyboard shortcut: N → open New Request (not while typing, not with modifiers)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
      const isEditable = tag === "input" || tag === "textarea" || tag === "select"
        || (document.activeElement as HTMLElement)?.isContentEditable;
      if (isEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setIsSlideOverOpen(true);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push("/sign-in");
    }
  }, [session, sessionLoading, router]);

  // Derive counts and filtered list from the single in-memory data array
  const stages = useMemo(() => {
    const allFeatures = data || [];
    return Object.keys(STATUS_BUCKETS).map((key) => {
      let count = 0;
      if (key === "all") {
        count = allFeatures.length;
      } else {
        const statuses = STATUS_BUCKETS[key];
        count = allFeatures.filter((f) => statuses.includes(f.status)).length;
      }
      return {
        id: key,
        label: STAGE_LABELS[key] || key,
        count,
      };
    });
  }, [data]);

  const filteredFeatures = useMemo(() => {
    const allFeatures = data || [];
    if (activeStageId === "all") return allFeatures;
    const statuses = STATUS_BUCKETS[activeStageId] || [];
    return allFeatures.filter((f) => statuses.includes(f.status));
  }, [data, activeStageId]);

  if (sessionLoading) return <DashboardSkeleton />;

  if (!session) return null;

  if (dataError?.data?.code === "FORBIDDEN") {
    return (
      <main className="container">
        <div className="card" style={{ padding: 32, display: "grid", gap: 12 }}>
          <strong>No workspace selected.</strong>
          <p className="muted">You don&apos;t have an active organization. Create a workspace to get started.</p>
          <a href="/onboarding" className="btn btn-primary" style={{ justifySelf: "start", display: "inline-block" }}>
            Create workspace →
          </a>
        </div>
      </main>
    );
  }

  const isPipelineCompletelyEmpty = !isLoading && (!data || data.length === 0);

  return (
    <main className="container space-y-8 py-10">
      {/* HEADER */}
      <div className="row flex items-center justify-between border-b border-subtle pb-6">
        <div>
          <h1 className="text-3xl font-display font-semibold text-ink">Dashboard</h1>
          <p className="text-xs text-ink-secondary mt-1">Manage and track your AI-driven product pipeline</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSlideOverOpen(true)}
            className="btn btn-primary flex items-center gap-2 px-4 py-2.5 text-sm font-medium"
          >
            <Plus size={16} /> New request
          </button>

          <div className="flex items-center gap-3 pl-4 border-l border-subtle">
            <span className="text-xs text-ink-secondary font-mono">{session.user.email}</span>
            <button
              className="badge badge--neutral cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => signOut({ fetchOptions: { onSuccess: () => router.push("/") } })}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* PIPELINE STRIP HEADER */}
      <PipelineStrip
        stages={stages}
        activeStageId={activeStageId}
        onStageClick={(id) => setActiveStageId(id)}
      />

      {/* FEATURE LIST & EMPTY STATES */}
      <div className="space-y-4 pt-2">
        {isLoading && <SkeletonList count={4} />}

        {isPipelineCompletelyEmpty && (
          <EmptyState
            icon={PlusCircle}
            title="Your pipeline is empty. Generate your first plan."
            actionLabel="New request"
            onAction={() => setIsSlideOverOpen(true)}
          />
        )}

        {!isPipelineCompletelyEmpty && filteredFeatures.length === 0 && (
          <EmptyState
            icon={FolderOpen}
            title="Nothing in this stage yet."
            actionLabel="New request"
            onAction={() => setIsSlideOverOpen(true)}
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

      {/* SLIDEOVER MODAL */}
      <NewRequestSlideOver
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        onCreated={() => refetch()}
      />
    </main>
  );
}
