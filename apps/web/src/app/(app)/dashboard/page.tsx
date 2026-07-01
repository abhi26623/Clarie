"use client";
export const dynamic = "force-dynamic";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useSession, signOut } from "@claire/auth/client";
import { SkeletonList } from "@claire/ui";
import { FeatureList } from "@/components/FeatureList";
import { NewRequestSlideOver } from "@/components/NewRequestSlideOver";
import { Plus } from "lucide-react";

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



export default function Dashboard() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const IN_FLIGHT_STATUSES = new Set([
    "received", "analyzing", "prd_generating", "tasks_generating", "in_development", "in_review",
  ]);

  const { data, isLoading: dataLoading, error: dataError, refetch } = trpc.feature.list.useQuery(undefined, {
    refetchInterval: (query) =>
      query.state.data?.some(f => IN_FLIGHT_STATUSES.has(f.status)) ? 2000 : false
  });
  // Self-heal workspace settings
  trpc.organization.ensureSettings.useQuery(undefined, {
    enabled: !!session?.session?.activeOrganizationId,
  });

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

      {/* PIPELINE STRIP + FEATURE LIST — shared with /features page */}
      <FeatureList
        data={data}
        isLoading={isLoading && !sessionLoading}
        onNewRequest={() => setIsSlideOverOpen(true)}
      />

      {/* SLIDEOVER MODAL */}
      <NewRequestSlideOver
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        onCreated={() => refetch()}
      />
    </main>
  );
}
