"use client";
export const dynamic = "force-dynamic";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useSession } from "@claire/auth/client";
import { SkeletonList } from "@claire/ui";
import { FeatureList } from "@/components/FeatureList";
import { NewRequestSlideOver } from "@/components/NewRequestSlideOver";
import { Plus } from "lucide-react";

// Co-located skeleton — matches the real header + pipeline strip + cards
function FeaturesSkeleton() {
  return (
    <main className="container space-y-8 py-10" style={{ maxWidth: 960 }}>
      <div className="flex items-center justify-between border-b border-subtle pb-6">
        <div className="flex flex-col gap-2">
          <div className="skeleton h-8 w-48 rounded" />
          <div className="skeleton h-3.5 w-72 rounded" />
        </div>
        <div className="skeleton h-9 w-32 rounded-md" />
      </div>
      <div className="flex items-center gap-4 border-b border-subtle pb-1">
        {[80, 72, 68, 76, 64, 60].map((w, i) => (
          <div key={i} className="skeleton rounded-full" style={{ height: 24, width: w }} />
        ))}
      </div>
      <SkeletonList count={6} />
    </main>
  );
}

export default function FeaturesPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const { data, isLoading: dataLoading, error, refetch } = trpc.feature.list.useQuery();

  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);

  const isLoading = sessionLoading || dataLoading;

  // Keyboard shortcut: N → open New Request
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
      const isEditable =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        (document.activeElement as HTMLElement)?.isContentEditable;
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

  if (sessionLoading) return <FeaturesSkeleton />;
  if (!session) return null;

  // No active org — same pattern as dashboard
  if (error?.data?.code === "FORBIDDEN") {
    return (
      <main className="container" style={{ maxWidth: 960 }}>
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
    <main className="container space-y-8 py-10" style={{ maxWidth: 960 }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-subtle pb-6">
        <div>
          <h1 className="text-3xl font-display font-semibold text-ink">Feature requests</h1>
          <p className="text-xs text-ink-secondary mt-1">
            Full backlog of all requests across every pipeline stage.
          </p>
        </div>
        <button
          onClick={() => setIsSlideOverOpen(true)}
          className="btn btn-primary flex items-center gap-2 px-4 py-2.5 text-sm font-medium"
        >
          <Plus size={16} /> New request
        </button>
      </div>

      {/* Pipeline strip + filtered card list — shared with dashboard */}
      <FeatureList
        data={data}
        isLoading={isLoading && !sessionLoading}
        onNewRequest={() => setIsSlideOverOpen(true)}
      />

      {/* Slide-over */}
      <NewRequestSlideOver
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        onCreated={() => refetch()}
      />
    </main>
  );
}

