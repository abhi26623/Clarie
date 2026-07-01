"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { authClient } from "@claire/auth/client";
import { SkeletonCard, StatusBadge, formatRelative } from "@claire/ui";
import { ArrowLeft, Clock, ShieldAlert, CheckCircle2, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export default function ApprovalsListPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { data: activeOrg } = authClient.useActiveOrganization();

  const currentUserMember = activeOrg?.members?.find((m) => m.userId === session?.user?.id);
  const isAdmin = currentUserMember?.role === "admin" || currentUserMember?.role === "owner";

  const { data: pendingFeatures, isLoading, error: approvalsError } = trpc.approval.listPending.useQuery(undefined, {
    enabled: !!activeOrg && isAdmin,
  });

  useEffect(() => {
    if (approvalsError) {
      toast.error(`Could not load approvals. ${approvalsError.message}`);
    }
  }, [approvalsError]);

  if (!activeOrg || (isLoading && isAdmin)) {
    return (
      <div className="container-wide py-12">
        <SkeletonCard />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container-wide py-12">
        <div className="card p-12 text-center border border-border bg-surface space-y-4 max-w-lg mx-auto">
          <ShieldAlert size={48} className="text-status-warning-fg mx-auto" />
          <h2 className="text-2xl font-display text-ink">You don&apos;t have access</h2>
          <p className="text-sm text-ink-secondary">
            You don&apos;t have access to this admin panel. If you require admin rights to approve feature plans, please contact your workspace owner.
          </p>
          <div className="pt-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="btn btn-primary"
            >
              <ArrowLeft size={16} /> Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-wide py-10 space-y-8">
      <div className="flex items-center justify-between border-b border-subtle pb-6">
        <div>
          <h1 className="text-3xl font-display text-ink mb-1">Approval Queue</h1>
          <p className="text-sm text-ink-secondary">
            Review feature request plans awaiting admin approval before generating engineering tasks.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 text-xs font-mono bg-surface-raised px-4 py-1.5 rounded-full border border-subtle text-ink-secondary">
          {pendingFeatures?.length ?? 0} pending review
        </div>
      </div>

      {(!pendingFeatures || pendingFeatures.length === 0) ? (
        <div className="empty-state">
          <CheckCircle2 size={48} className="text-status-success-fg mb-2" />
          <h3 className="empty-state__title">All Caught Up</h3>
          <p className="text-sm text-ink-secondary max-w-md mx-auto">
            There are no feature requests currently awaiting admin approval in this workspace.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingFeatures.map((feature) => {
            // "Time since ready" — derived from the latest AI review completion timestamp
            const latestReview = (feature as any).aiReviews?.[0];
            const readyTimestamp = latestReview?.completedAt;
            
            const timeSinceText = formatRelative(readyTimestamp);

            // AI Review Status (passed === true && status === 'completed' in blocking / non-blocking vocabulary)
            let reviewBadge = <span className="badge badge--neutral">No AI Review</span>;
            if (latestReview) {
              if (latestReview.passed === true && latestReview.status === "completed") {
                reviewBadge = <span className="badge badge--success">AI Review: Passed</span>;
              } else {
                const issues = latestReview.issues || [];
                const blockingCount = issues.filter((i: any) => i.severity === "BLOCKING").length;
                const nonBlockingCount = issues.filter((i: any) => i.severity === "NON_BLOCKING").length;
                const suggestionCount = issues.filter((i: any) => i.severity === "SUGGESTION").length;

                const parts = [];
                if (blockingCount > 0) parts.push(`${blockingCount} blocking`);
                if (nonBlockingCount > 0) parts.push(`${nonBlockingCount} non-blocking`);
                if (suggestionCount > 0 && parts.length === 0) parts.push(`${suggestionCount} suggestions`);

                reviewBadge = (
                  <span className="badge badge--warning">
                    AI Review: {parts.join(", ") || "Issues Found"}
                  </span>
                );
              }
            }

            return (
              <div
                key={feature.id}
                onClick={() => router.push(`/approvals/${feature.id}`)}
                className="card p-6 border border-border bg-surface hover:bg-surface-overlay hover:border-border-strong cursor-pointer transition-all flex items-center justify-between gap-6"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-lg font-medium text-ink truncate">{feature.title}</h3>
                    <StatusBadge status={feature.status as any} tier="active" />
                    {reviewBadge}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-ink-tertiary font-mono">
                    <span>Request #{feature.id}</span>
                    <span>·</span>
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} />
                      <span>Ready {timeSinceText}</span>
                    </div>
                    {feature.trackingToken && (
                      <>
                        <span>·</span>
                        <span>Token: {feature.trackingToken}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm font-medium text-accent">
                  <span>Review plan</span>
                  <ChevronRight size={16} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
