"use client";

import React, { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { authClient } from "@claire/auth/client";
import { SkeletonCard, ConfettiCelebration, Crossfade } from "@claire/ui";
import {
  ArrowLeft,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Check,
  Circle,
  ExternalLink,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { ApprovalTimeline } from "@/components/ApprovalTimeline";
import { RequirementCoverageCard } from "@/components/RequirementCoverageCard";

export default function ApprovalDecisionPage() {
  const params = useParams();
  const id = Number(params.id);
  const router = useRouter();

  const { data: session } = authClient.useSession();
  const { data: activeOrg } = authClient.useActiveOrganization();

  const currentUserMember = activeOrg?.members?.find((m) => m.userId === session?.user?.id);
  const isAdmin = currentUserMember?.role === "admin" || currentUserMember?.role === "owner";

  const { data: feature, isLoading } = trpc.approval.getContext.useQuery(
    { featureId: id },
    { enabled: !!activeOrg && isAdmin }
  );

  const submitMutation = trpc.approval.submit.useMutation();
  const shipMutation = trpc.approval.ship.useMutation();

  // Collapsible / Expandable UI States
  const [isPrdOpen, setIsPrdOpen] = useState(true);
  const [isReviewHistoryOpen, setIsReviewHistoryOpen] = useState(false);

  // Form states
  const [notes, setNotes] = useState("");
  const [isShipping, setIsShipping] = useState(false);
  const [shippedFeature, setShippedFeature] = useState<any | null>(null);

  // Deriving real dynamic checklist states
  const checklist = useMemo(() => {
    if (!feature) return { prdApproved: false, tasksDone: false, tasksCount: "0/0", reviewPassed: false, suggestionsCount: 0 };

    // 1. PRD Approved (derive from prd.approved boolean OR feature status progression past prd_ready)
    const prd = (feature as any).prd;
    const isPrdApproved = prd?.approved === true || ["tasks_ready", "in_development", "in_review", "ready_for_approval", "shipped"].includes(feature.status ?? "");

    // 2. Tasks done
    const tasks = (feature as any).tasks || [];
    const doneTasks = tasks.filter((t: any) => t.status === "done").length;
    const totalTasks = tasks.length;
    const isTasksDone = totalTasks > 0 && doneTasks === totalTasks;

    // 3. AI review passed + suggestions (latestReview.passed === true && latestReview.status === 'completed')
    const latestReview = (feature as any).aiReviews?.[0];
    const isReviewPassed = latestReview?.passed === true && latestReview?.status === "completed";
    const suggestions = latestReview?.issues?.filter((i: any) => i.severity === "SUGGESTION").length ?? 0;

    return {
      prdApproved: isPrdApproved,
      tasksDone: isTasksDone,
      tasksCount: `${doneTasks}/${totalTasks}`,
      reviewPassed: isReviewPassed,
      suggestionsCount: suggestions,
    };
  }, [feature]);

  const handleApproveAndShip = async () => {
    if (!feature) return;
    setIsShipping(true);
    try {
      // Single atomic transaction mutation that verifies ready_for_approval, records approval, computes timeToShipDays, and returns updated feature
      const updatedFeature = await shipMutation.mutateAsync({
        featureId: id,
        notes: notes || undefined,
      });

      setShippedFeature(updatedFeature);
      toast.success("Shipped");
    } catch (err: any) {
      toast.error(`Ship failed: ${err.message || "Unknown error"}. Please try again.`);
      setIsShipping(false);
    }
  };

  const handleSendBack = async () => {
    if (!feature) return;
    if (!notes || notes.trim() === "") {
      toast.error("Notes are required when sending back for fixes");
      return;
    }

    try {
      await submitMutation.mutateAsync({
        featureId: id,
        decision: "needs_changes",
        notes: notes.trim(),
      });
      toast.success("Feature sent back for fixes");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(`Failed to send back: ${err.message}`);
    }
  };

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

  if (!feature) {
    return (
      <div className="container-wide py-12 text-center">
        <p className="text-sm text-ink-secondary">Feature not found.</p>
      </div>
    );
  }

  const latestReview = (feature as any).aiReviews?.[0];
  const previousReviews = (feature as any).aiReviews?.slice(1) || [];
  const prd = (feature as any).prd;

  return (
    <div className="container-wide py-10">
      <button
        onClick={() => router.push("/approvals")}
        className="btn btn-ghost mb-8 pl-0 text-ink-secondary hover:text-ink"
      >
        <ArrowLeft size={16} /> Back to Approval Queue
      </button>

      <Crossfade stateKey={shippedFeature ? "shipped" : "decision"}>
        {shippedFeature ? (
          /* THE SHIP MOMENT */
          <div className="card p-12 text-center border border-border bg-surface max-w-2xl mx-auto space-y-8">
            <ConfettiCelebration triggerKey="shipped" />
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-100 text-green-800 rounded-full font-mono text-xs mb-2">
                <Check size={14} /> Feature Shipped to Production
              </div>
              <h2 className="text-4xl font-display text-ink">{shippedFeature.title || feature.title}</h2>
              <p className="text-sm text-ink-secondary font-mono">
                Requested by {feature.submitterName || feature.submitterEmail || "Anonymous"} on{" "}
                {feature.createdAt ? new Date(feature.createdAt).toLocaleDateString() : "N/A"}
              </p>
              <p className="text-sm text-ink-secondary font-mono">
                Shipped on {shippedFeature.updatedAt ? new Date(shippedFeature.updatedAt).toLocaleDateString() : new Date().toLocaleDateString()}
              </p>
            </div>

            <div className="p-6 bg-surface-raised border border-subtle rounded-lg">
              <p className="text-2xl font-display text-accent mb-1">
                {shippedFeature.timeToShipDays ?? 1} days
              </p>
              <p className="text-xs text-ink-tertiary font-mono uppercase tracking-wider">
                from idea to production
              </p>
            </div>

            <div className="flex items-center justify-center gap-4 pt-4 border-t border-subtle">
              <button
                onClick={() => router.push(`/requests/${feature.id}`)}
                className="btn btn-secondary py-3 px-6"
              >
                <ExternalLink size={16} /> View timeline
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="btn btn-primary py-3 px-6"
              >
                Return to dashboard
              </button>
            </div>
          </div>
        ) : (
          /* TWO COLUMN DECISION PAGE (Vanilla CSS Grid) */
          <div className="approval-grid">
            {/* LEFT COLUMN (60%): PRD Summary, AI Review Result, Task Completion */}
            <div className="space-y-6">
              <div className="border-b border-subtle pb-4">
                <h1 className="text-3xl font-display text-ink mb-1">{feature.title}</h1>
                <p className="text-sm text-ink-tertiary font-mono">
                  Request #{feature.id} · Token: {feature.trackingToken}
                </p>
              </div>

              {/* Collapsible PRD Summary */}
              <div className="card p-6 border border-border bg-surface space-y-4">
                <div
                  onClick={() => setIsPrdOpen(!isPrdOpen)}
                  className="flex items-center justify-between cursor-pointer select-none"
                >
                  <h3 className="text-label font-medium text-ink">PRD Summary</h3>
                  {isPrdOpen ? <ChevronUp size={18} className="text-ink-tertiary" /> : <ChevronDown size={18} className="text-ink-tertiary" />}
                </div>
                {isPrdOpen && prd && (
                  <div className="space-y-4 pt-2 border-t border-subtle text-sm text-ink-secondary">
                    <div>
                      <h4 className="font-medium text-ink mb-1">Problem Statement</h4>
                      <p className="leading-relaxed">{prd.problemStatement || "No problem statement provided."}</p>
                    </div>
                    {prd.goals && (prd.goals as string[]).length > 0 && (
                      <div>
                        <h4 className="font-medium text-ink mb-1">Goals</h4>
                        <ul className="space-y-1 list-disc pl-4 text-xs">
                          {(prd.goals as string[]).map((g, idx) => (
                            <li key={idx}>{g}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {prd.acceptanceCriteria && (prd.acceptanceCriteria as any[]).length > 0 && (
                      <div>
                        <h4 className="font-medium text-ink mb-1">Acceptance Criteria</h4>
                        <ul className="space-y-1 list-disc pl-4 text-xs">
                          {(prd.acceptanceCriteria as Array<{ id: string; text: string } | string>).map((ac, idx) => (
                            <li key={idx}>{typeof ac === "string" ? ac : ac.text}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Latest AI Review Result + Expandable History */}
              <div className="card p-6 border border-border bg-surface space-y-6">
                <div className="flex items-center justify-between border-b border-subtle pb-3">
                  <h3 className="text-label font-medium text-ink">AI Review Findings</h3>
                  {latestReview?.passed === true && latestReview?.status === "completed" ? (
                    <span className="badge badge--success">Review Passed</span>
                  ) : (
                    <span className="badge badge--warning">Review Issues Found</span>
                  )}
                </div>

                {latestReview ? (
                  <div className="space-y-4">
                    <p className="text-sm text-ink-secondary">{latestReview.summary || "AI review completed with no additional summary."}</p>

                    <RequirementCoverageCard
                      verdicts={latestReview.criteriaVerdicts}
                      prd={prd}
                      featureRequestId={feature.id}
                    />

                    {latestReview.issues && latestReview.issues.length > 0 && (
                      <div className="space-y-3">
                        {latestReview.issues.map((issue: any) => (
                          <div key={issue.id} className="p-4 bg-surface-raised border border-subtle rounded-md space-y-1.5">
                            <div className="flex items-center gap-2 text-xs font-mono">
                              <span className={`px-2 py-0.5 rounded ${issue.severity === "BLOCKING" ? "bg-status-error-bg text-status-error-fg border border-status-error-border" : issue.severity === "NON_BLOCKING" ? "bg-status-warning-bg text-status-warning-fg border border-status-warning-border" : "bg-status-neutral-bg text-status-neutral-fg border border-status-neutral-border"}`}>
                                {issue.severity === "BLOCKING" ? "Blocking" : issue.severity === "NON_BLOCKING" ? "Non-blocking" : "Suggestion"}
                              </span>
                              <span className="text-ink font-medium">{issue.title}</span>
                            </div>
                            <p className="text-xs text-ink-secondary pl-2 border-l-2 border-subtle">{issue.description}</p>
                            {issue.suggestion && (
                              <p className="text-2xs text-accent font-mono pl-2">Suggestion: {issue.suggestion}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {previousReviews.length > 0 && (
                      <div className="pt-4 border-t border-subtle">
                        <div
                          onClick={() => setIsReviewHistoryOpen(!isReviewHistoryOpen)}
                          className="flex items-center justify-between cursor-pointer select-none text-xs text-ink-tertiary hover:text-ink"
                        >
                          <span>{isReviewHistoryOpen ? "Hide previous review history" : `View previous review history (${previousReviews.length})`}</span>
                          {isReviewHistoryOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>

                        {isReviewHistoryOpen && (
                          <div className="space-y-4 pt-4">
                            {previousReviews.map((prev: any) => (
                              <div key={prev.id} className="p-4 bg-canvas border border-subtle rounded-md space-y-2 text-xs">
                                <div className="flex items-center justify-between font-mono text-2xs text-ink-tertiary">
                                  <span>Review #{prev.reviewNumber}</span>
                                  <span>{prev.completedAt ? new Date(prev.completedAt).toLocaleDateString() : "N/A"}</span>
                                </div>
                                <p className="text-ink-secondary">{prev.summary}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-ink-secondary">No AI reviews recorded for this feature request.</p>
                )}
              </div>

              {/* Task Completion */}
              <div className="card p-6 border border-border bg-surface flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-label font-medium text-ink mb-1">Engineering Tasks</h3>
                  <p className="text-xs text-ink-tertiary">Generated execution checklist items for this feature.</p>
                </div>
                <div className="text-sm font-mono text-ink bg-surface-raised px-4 py-2 rounded-md border border-subtle">
                  {checklist.tasksCount} done
                </div>
              </div>

              {/* Full Approval History Timeline */}
              <ApprovalTimeline featureId={id} />
            </div>

            {/* RIGHT COLUMN (40%, STICKY): ApprovalPanel */}
            <div className="sticky top-8 card p-6 border border-border bg-surface space-y-6">
              <div className="border-b border-subtle pb-3">
                <h3 className="text-lg font-display text-ink">Approval Panel</h3>
                <p className="text-xs text-ink-tertiary">Review checklist before shipping plan to production</p>
              </div>

              {/* Checklist derived from real dynamic data */}
              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between p-2.5 bg-canvas rounded border border-subtle">
                  <span className="text-ink-secondary">PRD Approved</span>
                  {checklist.prdApproved ? (
                    <span className="inline-flex items-center gap-1.5 text-status-success-fg font-medium"><Check size={14} /> ✓</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-ink-tertiary"><Circle size={14} /> ○</span>
                  )}
                </div>

                <div className="flex items-center justify-between p-2.5 bg-canvas rounded border border-subtle">
                  <span className="text-ink-secondary">Tasks Completed ({checklist.tasksCount})</span>
                  {checklist.tasksDone ? (
                    <span className="inline-flex items-center gap-1.5 text-status-success-fg font-medium"><Check size={14} /> ✓</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-ink-tertiary"><Circle size={14} /> ○</span>
                  )}
                </div>

                <div className="flex items-center justify-between p-2.5 bg-canvas rounded border border-subtle">
                  <span className="text-ink-secondary">AI Review Passed</span>
                  {checklist.reviewPassed ? (
                    <span className="inline-flex items-center gap-1.5 text-status-success-fg font-medium"><Check size={14} /> ✓</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-status-warning-fg font-medium">{checklist.suggestionsCount} suggestions</span>
                  )}
                </div>
              </div>

              {/* Optional Notes */}
              <div>
                <label className="block text-sm font-medium text-ink-secondary mb-1">
                  Optional Notes {notes.trim() === "" && <span className="text-ink-tertiary text-xs font-normal">(Required for send back)</span>}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Provide approval reasoning or change requests..."
                  disabled={isShipping || submitMutation.isPending || shipMutation.isPending}
                  className="input min-h-[100px] p-3 text-xs"
                />
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <button
                  onClick={handleApproveAndShip}
                  disabled={isShipping || submitMutation.isPending || shipMutation.isPending}
                  className="btn btn-primary w-full justify-center py-3 text-base font-medium"
                >
                  {isShipping ? "Shipping…" : "Approve & ship"}
                </button>

                <button
                  onClick={handleSendBack}
                  disabled={isShipping || submitMutation.isPending || shipMutation.isPending}
                  className="btn btn-secondary w-full justify-center py-3 text-base font-medium"
                >
                  Send back for fixes
                </button>
              </div>

              {/* Click-Fear Removal Footer Note */}
              <div className="p-3 bg-surface-raised border border-subtle rounded-md flex items-start gap-2.5 text-ink-tertiary text-xs pt-3 border-t">
                <Info size={16} className="text-accent flex-shrink-0 mt-0.5" />
                <span>You are approving the feature plan, not deploying code.</span>
              </div>
            </div>
          </div>
        )}
      </Crossfade>
    </div>
  );
}
