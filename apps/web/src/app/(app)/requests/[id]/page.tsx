"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { authClient } from "@claire/auth/client";
import {
  PhaseStepper,
  WorkflowProgress,
  Crossfade,
  Stagger,
  ConfettiCelebration,
  SkeletonCard,
  StatusBadge,
  KanbanBoard,
  parseDbTimestamp,
} from "@claire/ui";
import {
  Check,
  AlertTriangle,
  ExternalLink,
  Edit2,
  X,
  Save,
  ArrowLeft,
  Clock,
  User,
  Folder,
  GitPullRequest,
  CheckCircle2,
  GitMerge,
  ShieldCheck,
  Circle,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ApprovalTimeline } from "@/components/ApprovalTimeline";

function ShippedCelebration({ timeToShipDays }: { timeToShipDays?: number | null }) {
  return (
    <div className="card p-8 text-center border border-border bg-surface">
      <ConfettiCelebration triggerKey="shipped" />
      <h2 className="text-display-sm text-ink mb-2">Feature Shipped!</h2>
      <p className="text-sm text-ink-secondary mb-6">
        Successfully deployed to production in {timeToShipDays ?? 1} days.
      </p>
      <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-100 text-green-800 rounded-full font-mono text-xs">
        <Check size={14} /> Ready for users
      </div>
    </div>
  );
}

function RetryButton({ featureId, onSuccess }: { featureId: number; onSuccess: () => void }) {
  const retryMutation = trpc.feature.retryIntake.useMutation({ onSuccess });
  return (
    <button
      className="btn btn-primary"
      disabled={retryMutation.isPending}
      onClick={() => retryMutation.mutate({ id: featureId })}
    >
      {retryMutation.isPending ? "Retrying…" : "Try again"}
    </button>
  );
}


export default function FeatureDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const router = useRouter();

  const { data: session } = authClient.useSession();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const currentUserMember = activeOrg?.members?.find((m) => m.userId === session?.user?.id);
  const isAdmin = currentUserMember?.role === "admin" || currentUserMember?.role === "owner";

  const IN_FLIGHT_STATUSES = [
    "analyzing",
    "prd_generating",
    "tasks_generating",
    "in_development",
    "in_review",
  ];

  const { data: feature, isLoading, refetch: refetchFeature, error: featureError } = trpc.feature.getById.useQuery(
    { id },
    {
      refetchInterval: (query) =>
        query.state.data && IN_FLIGHT_STATUSES.includes(query.state.data.status ?? "") ? 1200 : false,
    }
  );

  const lastShownError = React.useRef<string | null>(null);
  useEffect(() => {
    if (featureError && featureError.message !== lastShownError.current) {
      lastShownError.current = featureError.message;
      toast.error(`Could not load feature. ${featureError.message}`);
    }
    if (!featureError) {
      lastShownError.current = null;
    }
  }, [featureError]);

  const { data: stepsData } = trpc.workflow.getSteps.useQuery(
    { entityType: "feature_request", entityId: String(id) },
    {
      refetchInterval: () =>
        feature && IN_FLIGHT_STATUSES.includes(feature.status ?? "") ? 1200 : false,
    }
  );

  const getStatusLabel = (st: string) => {
    const map: Record<string, string> = {
      received: "Received",
      analyzing: "Analyzing",
      clarification_needed: "Clarification Needed",
      prd_generating: "Generating PRD",
      prd_ready: "PRD Ready",
      tasks_generating: "Generating Tasks",
      tasks_ready: "Tasks Ready",
      in_development: "In Development",
      in_review: "In Review",
      fix_needed: "Fix Needed",
      ready_for_approval: "Ready for Approval",
      shipped: "Shipped",
      failed: "Failed",
      rejected: "Rejected",
      duplicate: "Duplicate",
      feature_exists: "Feature Exists",
      bug_report: "Bug Report",
      out_of_scope: "Out of Scope"
    };
    return map[st] || st;
  };

  const phases = useMemo(() => {
    if (!feature) return [];
    const st = feature.status;

    // 1. Discovery
    let discState: "done" | "active" | "pending" = "done";
    if (st === "received" || st === "analyzing" || st === "clarification_needed") discState = "active";

    // 2. Planning
    let planState: "done" | "active" | "pending" = "pending";
    if (["prd_generating", "prd_ready", "tasks_generating", "tasks_ready"].includes(st)) planState = "active";
    else if (["in_development", "in_review", "fix_needed", "ready_for_approval", "shipped"].includes(st)) planState = "done";

    // 3. Development
    let devState: "done" | "active" | "pending" = "pending";
    if (["in_development", "fix_needed"].includes(st)) devState = "active";
    else if (["in_review", "ready_for_approval", "shipped"].includes(st)) devState = "done";

    // 4. Review
    let revState: "done" | "active" | "pending" = "pending";
    if (st === "in_review") revState = "active";
    else if (["ready_for_approval", "shipped"].includes(st)) revState = "done";

    // 5. Approval
    let appState: "done" | "active" | "pending" = "pending";
    if (st === "ready_for_approval") appState = "active";
    else if (st === "shipped") appState = "done";
    else if (st === "rejected" || st === "failed" || st === "duplicate" || st === "feature_exists" || st === "bug_report" || st === "out_of_scope") appState = "done";

    const isInFlight = IN_FLIGHT_STATUSES.includes(st);

    return [
      {
        id: "discovery",
        label: "Discovery",
        state: discState,
        meta: feature.createdAt ? parseDbTimestamp(feature.createdAt)?.toLocaleDateString() : "",
        isStatusInFlight: isInFlight && discState === "active",
      },
      {
        id: "planning",
        label: "Planning",
        state: planState,
        meta: planState === "done" ? "Completed" : planState === "active" ? "In Progress" : "",
        isStatusInFlight: isInFlight && planState === "active",
      },
      {
        id: "development",
        label: "Development",
        state: devState,
        meta: devState === "done" ? "Completed" : devState === "active" ? "In Progress" : "",
        isStatusInFlight: isInFlight && devState === "active",
      },
      {
        id: "review",
        label: "Review",
        state: revState,
        meta: revState === "done" ? "Completed" : revState === "active" ? "In Progress" : "",
        isStatusInFlight: isInFlight && revState === "active",
      },
      {
        id: "approval",
        label: "Approval",
        state: appState,
        meta: st === "shipped" ? "Shipped" : st === "rejected" ? "Rejected" : appState === "active" ? "Pending Admin" : "",
        isStatusInFlight: isInFlight && appState === "active",
      },
    ];
  }, [feature]);

  const workflowStepsMapped = useMemo(() => {
    if (!stepsData) return [];
    return stepsData.map((s) => ({
      id: String(s.id),
      label: (s.partialResult as { label?: string })?.label ?? s.step,
      state: s.status === "done" ? ("done" as const) : s.status === "running" ? ("active" as const) : ("pending" as const),
      meta: s.status === "done" ? "Done" : s.status === "running" ? "Running" : "Pending",
      isStatusInFlight: s.status === "running",
    }));
  }, [stepsData]);

  // Clarification state
  const [clarificationAnswer, setClarificationAnswer] = useState("");
  const answerClarificationMutation = trpc.feature.answerClarification.useMutation({
    onSuccess: () => {
      refetchFeature();
      setClarificationAnswer("");
    },
  });

  const latestThread = useMemo(() => {
    if (!feature?.clarificationThreads || feature.clarificationThreads.length === 0) return null;
    return [...feature.clarificationThreads].sort(
      (a, b) => (parseDbTimestamp(b.askedAt)?.getTime() ?? 0) - (parseDbTimestamp(a.askedAt)?.getTime() ?? 0)
    )[0];
  }, [feature?.clarificationThreads]);

  // PRD Inline Edit state
  const [isEditingPrd, setIsEditingPrd] = useState(false);

  const isKanbanView = feature && ["tasks_ready", "in_development", "fix_needed"].includes(feature.status ?? "");
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(!isKanbanView);

  useEffect(() => {
    setIsPropertiesOpen(!isKanbanView);
  }, [isKanbanView]);

  const [editProblemStatement, setEditProblemStatement] = useState("");
  const [editGoals, setEditGoals] = useState("");
  const [editNonGoals, setEditNonGoals] = useState("");
  const [editUserStories, setEditUserStories] = useState("");
  const [editAcceptanceCriteria, setEditAcceptanceCriteria] = useState("");
  const [editEdgeCases, setEditEdgeCases] = useState("");
  const [editSuccessMetrics, setEditSuccessMetrics] = useState("");

  useEffect(() => {
    if (feature?.prd) {
      setEditProblemStatement(feature.prd.problemStatement ?? "");
      setEditGoals(JSON.stringify(feature.prd.goals ?? [], null, 2));
      setEditNonGoals(JSON.stringify(feature.prd.nonGoals ?? [], null, 2));
      setEditUserStories(JSON.stringify(feature.prd.userStories ?? [], null, 2));
      setEditAcceptanceCriteria(JSON.stringify(feature.prd.acceptanceCriteria ?? [], null, 2));
      setEditEdgeCases(JSON.stringify(feature.prd.edgeCases ?? [], null, 2));
      setEditSuccessMetrics(JSON.stringify(feature.prd.successMetrics ?? [], null, 2));
    }
  }, [feature?.prd, isEditingPrd]);

  const { data: tasksData, isLoading: isLoadingTasks, refetch: refetchTasks } = trpc.task.listByFeature.useQuery(
    { featureId: id },
    {
      enabled: !!feature && ["tasks_ready", "in_development", "fix_needed"].includes(feature.status ?? ""),
    }
  );

  const updateTaskStatusMutation = trpc.task.updateStatus.useMutation({
    onSuccess: () => {
      refetchTasks();
    },
  });

  const updateTaskOrderMutation = trpc.task.updateOrder.useMutation({
    onSuccess: () => {
      refetchTasks();
    },
  });

  const assignTaskMutation = trpc.task.assign.useMutation({
    onSuccess: () => {
      refetchTasks();
    },
  });

  const prdUpdateMutation = trpc.prd.update.useMutation({
    onSuccess: () => {
      setIsEditingPrd(false);
      refetchFeature();
    },
  });

  const prdApproveMutation = trpc.prd.approve.useMutation({
    onSuccess: () => {
      refetchFeature();
    },
  });

  const prdRejectMutation = trpc.prd.reject.useMutation({
    onSuccess: () => {
      refetchFeature();
    },
  });

  const handleSavePrd = async () => {
    if (!feature?.prd) return;
    try {
      await prdUpdateMutation.mutateAsync({
        id: feature.prd.id,
        featureId: feature.id,
        problemStatement: editProblemStatement,
        goals: JSON.parse(editGoals),
        nonGoals: JSON.parse(editNonGoals),
        userStories: JSON.parse(editUserStories),
        acceptanceCriteria: JSON.parse(editAcceptanceCriteria),
        edgeCases: JSON.parse(editEdgeCases),
        successMetrics: JSON.parse(editSuccessMetrics),
      });
    } catch (e) {
      toast.error("JSON parse failed in one of the fields. Check that each field is a valid JSON array.");
    }
  };

  if (isLoading || !feature) {
    return (
      <div className="container-wide py-12">
        <SkeletonCard />
      </div>
    );
  }

  const renderCenterContent = () => {
    switch (feature.status) {
      case "received":
        return (
          <div className="card p-8 text-center border border-border bg-surface">
            <h3 className="text-xl font-semibold text-ink mb-2">Request Received</h3>
            <p className="text-sm text-ink-secondary">
              We have received your request and will begin analysis shortly.
            </p>
          </div>
        );

      case "analyzing":
      case "prd_generating":
      case "tasks_generating":
        return (
          <div className="card p-8 border border-border bg-surface">
            <h3 className="text-xl font-semibold text-ink mb-6">Live Generation in Progress</h3>
            <WorkflowProgress steps={workflowStepsMapped} />
          </div>
        );

      case "clarification_needed":
        return (
          <div className="card p-8 border border-border bg-surface">
            <h3 className="text-xl font-semibold text-ink mb-4">Clarification Needed</h3>
            {latestThread ? (
              <div className="space-y-6">
                <div className="p-4 bg-surface-raised border border-subtle rounded-md">
                  <h4 className="text-sm font-medium text-ink mb-2">AI Question:</h4>
                  <p className="text-sm text-ink-secondary">{latestThread.question}</p>
                </div>

                {latestThread.questionType === "CHOICE" && latestThread.options ? (
                  <div className="space-y-3">
                    {(latestThread.options as string[]).map((opt, idx) => (
                      <label key={idx} className="clarification-choice flex items-center gap-3">
                        <input
                          type="radio"
                          name="clarification-opt"
                          value={opt}
                          checked={clarificationAnswer === opt}
                          onChange={(e) => setClarificationAnswer(e.target.value)}
                          className="text-accent focus:ring-accent"
                        />
                        <span className="text-sm text-ink-secondary">{opt}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-ink-secondary mb-2">
                      Your Answer
                    </label>
                    <textarea
                      value={clarificationAnswer}
                      onChange={(e) => setClarificationAnswer(e.target.value)}
                      className="input min-h-[120px] p-3"
                      placeholder="Provide clarification details..."
                    />
                  </div>
                )}

                <button
                  onClick={() =>
                    answerClarificationMutation.mutate({
                      threadId: latestThread.id,
                      featureId: feature.id,
                      answer: clarificationAnswer,
                    })
                  }
                  disabled={!clarificationAnswer || answerClarificationMutation.isPending}
                  className="btn btn-primary w-full justify-center py-3"
                >
                  {answerClarificationMutation.isPending ? "Submitting..." : "Submit Answer"}
                </button>
              </div>
            ) : (
              <p className="text-sm text-ink-secondary">No active clarification questions found.</p>
            )}
          </div>
        );

      case "prd_ready":
        if (!feature.prd) {
          return (
            <div className="card p-8 text-center border border-border bg-surface">
              <p className="text-sm text-ink-secondary">PRD is ready but no document was found.</p>
            </div>
          );
        }

        if (isEditingPrd) {
          return (
            <div className="card p-8 border border-border bg-surface space-y-6">
              <div className="flex items-center justify-between border-b border-subtle pb-4">
                <h3 className="text-xl font-semibold text-ink">Edit PRD</h3>
                <button
                  onClick={() => setIsEditingPrd(false)}
                  className="btn btn-ghost p-2"
                >
                  <X size={18} />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-secondary mb-1">
                  Problem Statement
                </label>
                <textarea
                  value={editProblemStatement}
                  onChange={(e) => setEditProblemStatement(e.target.value)}
                  className="input min-h-[100px]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-ink-secondary mb-1">
                    Goals (JSON array)
                  </label>
                  <textarea
                    value={editGoals}
                    onChange={(e) => setEditGoals(e.target.value)}
                    className="input font-mono text-xs min-h-[150px]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-secondary mb-1">
                    Non-Goals (JSON array)
                  </label>
                  <textarea
                    value={editNonGoals}
                    onChange={(e) => setEditNonGoals(e.target.value)}
                    className="input font-mono text-xs min-h-[150px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-secondary mb-1">
                  User Stories (JSON array)
                </label>
                <textarea
                  value={editUserStories}
                  onChange={(e) => setEditUserStories(e.target.value)}
                  className="input font-mono text-xs min-h-[150px]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-secondary mb-1">
                  {"Acceptance Criteria (JSON array of {id, text} objects)"}
                </label>
                <textarea
                  value={editAcceptanceCriteria}
                  onChange={(e) => setEditAcceptanceCriteria(e.target.value)}
                  className="input font-mono text-xs min-h-[150px]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-ink-secondary mb-1">
                    Edge Cases (JSON array)
                  </label>
                  <textarea
                    value={editEdgeCases}
                    onChange={(e) => setEditEdgeCases(e.target.value)}
                    className="input font-mono text-xs min-h-[120px]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-secondary mb-1">
                    Success Metrics (JSON array)
                  </label>
                  <textarea
                    value={editSuccessMetrics}
                    onChange={(e) => setEditSuccessMetrics(e.target.value)}
                    className="input font-mono text-xs min-h-[120px]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-subtle">
                <button
                  onClick={() => setIsEditingPrd(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePrd}
                  disabled={prdUpdateMutation.isPending}
                  className="btn btn-primary"
                >
                  <Save size={16} /> {prdUpdateMutation.isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          );
        }

        const prd = feature.prd;
        const itemVariant = {
          hidden: { opacity: 0, y: 4 },
          show: { opacity: 1, y: 0 },
        };

        return (
          <div className="space-y-8 pb-24">
            <Stagger className="space-y-8">
              {/* Problem Statement */}
              <motion.div variants={itemVariant} className="card p-8 border border-border bg-surface">
                <h3 className="eyebrow !text-[var(--green-800)] mb-3">Problem Statement</h3>
                <p className="text-md font-sans text-ink-secondary leading-relaxed max-w-[65ch]">
                  {prd.problemStatement}
                </p>
              </motion.div>

              {/* Goals / Non-Goals */}
              <motion.div variants={itemVariant} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card p-6 border border-border bg-surface border-l-2 border-l-[var(--green-800)]">
                  <h3 className="text-label !text-[var(--green-800)] mb-4">Goals</h3>
                  <ul className="space-y-2 list-disc list-outside pl-4">
                    {(prd.goals as string[] | null)?.map((goal, idx) => (
                      <li key={idx} className="text-sm text-ink-secondary">
                        {goal}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="card p-6 border border-border bg-surface border-l-2 border-l-[var(--border-strong)]">
                  <h3 className="text-label !text-[var(--green-800)] mb-4">Non-Goals</h3>
                  <ul className="space-y-2 list-disc list-outside pl-4">
                    {(prd.nonGoals as string[] | null)?.map((ngoal, idx) => (
                      <li key={idx} className="text-sm text-ink-tertiary muted">
                        {ngoal}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>

              {/* User Stories */}
              <motion.div variants={itemVariant} className="card p-6 border border-border bg-surface">
                <h3 className="text-label !text-[var(--green-800)] mb-4">User Stories</h3>
                <div className="space-y-3">
                  {(prd.userStories as string[] | null)?.map((story, idx) => (
                    <div key={idx} className="p-4 bg-surface-raised border border-subtle rounded-md text-sm text-ink-secondary">
                      {story}
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Acceptance Criteria */}
              <motion.div variants={itemVariant} className="card p-6 border border-border bg-surface">
                <h3 className="text-label !text-[var(--green-800)] mb-4">Acceptance Criteria</h3>
                {(() => {
                  const prdCriteria = Array.isArray(prd.acceptanceCriteria) ? prd.acceptanceCriteria : [];
                  const latestReview = [...(feature.aiReviews ?? [])].sort(
                    (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
                  )[0];
                  const verdicts = latestReview?.criteriaVerdicts as Array<{criterionId: string; text?: string; verdict: "met"|"partial"|"not_met"; evidence: string}> | undefined;
                  const hasReview = verdicts && verdicts.length > 0;

                  const criteriaList = prdCriteria.map((crit: any) => {
                    const id = typeof crit === "string" ? crit : crit.id;
                    const text = typeof crit === "string" ? crit : crit.text;
                    const verdictMatch = hasReview ? verdicts.find(v => v.criterionId === id || (typeof crit === "string" && crit === v.criterionId)) : null;
                    return { id, text, verdict: verdictMatch?.verdict, evidence: verdictMatch?.evidence };
                  });

                  const metCount = criteriaList.filter(c => c.verdict === "met").length;
                  const totalCount = criteriaList.length;

                  return (
                    <div className="space-y-3">
                      {hasReview && totalCount > 0 && (
                        <div className="text-xs font-medium text-ink-secondary mb-2">
                          {metCount} of {totalCount} criteria met
                        </div>
                      )}
                      {criteriaList.map((crit, idx) => {
                        let rowClass = "flex items-start gap-3 p-3 bg-canvas border border-subtle rounded-md text-sm text-ink-secondary";
                        let Icon = Circle;
                        let iconClass = "text-ink-tertiary flex-shrink-0 mt-0.5";

                        if (hasReview) {
                          if (crit.verdict === "met") {
                            rowClass = "flex items-start gap-3 p-3 bg-[var(--status-success-bg)] border-y border-r border-l-2 border-l-[var(--status-success-border)] border-y-[var(--border-subtle)] border-r-[var(--border-subtle)] rounded-md text-sm text-ink-secondary";
                            Icon = Check;
                            iconClass = "text-[var(--status-success-fg)] flex-shrink-0 mt-0.5";
                          } else if (crit.verdict === "partial") {
                            rowClass = "flex items-start gap-3 p-3 bg-[var(--status-warning-bg)] border-y border-r border-l-2 border-l-[var(--status-warning-border)] border-y-[var(--border-subtle)] border-r-[var(--border-subtle)] rounded-md text-sm text-ink-secondary";
                            Icon = AlertTriangle;
                            iconClass = "text-[var(--status-warning-fg)] flex-shrink-0 mt-0.5";
                          } else {
                            rowClass = "flex items-start gap-3 p-3 bg-[var(--status-error-bg)] border-y border-r border-l-2 border-l-[var(--status-error-border)] border-y-[var(--border-subtle)] border-r-[var(--border-subtle)] rounded-md text-sm text-ink-secondary";
                            Icon = X;
                            iconClass = "text-[var(--status-error-fg)] flex-shrink-0 mt-0.5";
                          }
                        }

                        return (
                          <div key={idx} className={rowClass}>
                            <Icon size={16} className={iconClass} />
                            <div className="flex-1 flex flex-col gap-1">
                              <span>{crit.text}</span>
                              {crit.evidence && <span className="text-xs font-mono text-[var(--status-neutral-fg)] opacity-80 mt-1">↳ {crit.evidence}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </motion.div>

              {/* Edge Cases & Success Metrics */}
              <motion.div variants={itemVariant} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card p-6 border border-border bg-surface border-l-2 border-l-[var(--status-warning-border)]">
                  <h3 className="text-label !text-[var(--green-800)] mb-4">Edge Cases</h3>
                  <div className="space-y-3">
                    {(prd.edgeCases as string[] | null)?.map((edge, idx) => (
                      <div key={idx} className="flex items-start gap-3 text-sm text-ink-secondary">
                        <AlertTriangle size={16} className="text-[var(--status-warning-fg)] flex-shrink-0 mt-0.5" />
                        <span>{edge}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card p-6 border border-border bg-surface">
                  <h3 className="text-label !text-[var(--green-800)] mb-4">Success Metrics</h3>
                  <ul className="space-y-2 list-disc list-outside pl-4">
                    {(prd.successMetrics as string[] | null)?.map((met, idx) => (
                      <li key={idx} className="text-sm text-ink-secondary">
                        {met}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>

              {/* Admin Actions */}
              {isAdmin && (
                <motion.div variants={itemVariant} className="sticky bottom-0 z-[var(--z-sticky)] p-4 border-t border-[var(--border-subtle)] bg-[var(--surface)] flex flex-wrap items-center justify-between gap-4 mt-8 -mx-6 px-6 lg:mx-0 lg:px-6 lg:rounded-b-lg shadow-sm">
                  <div>
                    <h4 className="text-sm font-medium text-ink">Admin Plan Review</h4>
                    <p className="text-xs text-ink-tertiary">Review and approve this PRD to generate engineering tasks.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsEditingPrd(true)}
                      className="btn btn-ghost"
                    >
                      <Edit2 size={16} /> Edit
                    </button>
                    <button
                      onClick={() => prdRejectMutation.mutate({ id: prd.id, featureId: feature.id })}
                      disabled={prdRejectMutation.isPending || prdApproveMutation.isPending}
                      className="btn btn-secondary"
                    >
                      {prdRejectMutation.isPending ? "Rejecting..." : "Reject"}
                    </button>
                    <button
                      onClick={() => prdApproveMutation.mutate({ id: prd.id, featureId: feature.id })}
                      disabled={prdApproveMutation.isPending || prdRejectMutation.isPending}
                      className="btn btn-primary"
                    >
                      <CheckCircle2 size={16} /> {prdApproveMutation.isPending ? "Approving..." : "Approve plan"}
                    </button>
                  </div>
                </motion.div>
              )}
            </Stagger>
          </div>
        );

      case "tasks_ready":
      case "in_development":
      case "fix_needed":
        return (
          <div className="space-y-6">
            {feature.status === "fix_needed" && (
              <div className="space-y-6">
                <div className="card p-6 border border-status-warning-border bg-surface space-y-3">
                  <div className="flex items-center gap-2 text-status-warning-fg font-medium text-sm">
                    <AlertTriangle size={18} />
                    <span>Fixes Needed — AI Review & Admin Feedback</span>
                  </div>
                  <p className="text-sm text-ink-secondary">
                    {feature.aiReasoning || "Review identified blocking issues or changes requested by admin. Please address the tasks below before resubmitting for approval."}
                  </p>
                </div>
                <ApprovalTimeline featureId={feature.id} />
              </div>
            )}

            <div className="flex items-center justify-between border-b border-subtle pb-4 shrink-0">
              <div>
                <h3 className="text-xl font-semibold text-ink">Kanban Board</h3>
                <p className="text-sm text-ink-secondary">
                  Drag and drop tasks across columns to update their status.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="inline-block text-xs font-mono text-ink-tertiary bg-surface-raised px-4 py-1.5 rounded-full border border-subtle">
                  {tasksData?.length ?? 0} tasks loaded
                </div>
                <button
                  onClick={() => setIsPropertiesOpen(!isPropertiesOpen)}
                  className="btn btn-secondary text-xs py-1.5"
                >
                  {isPropertiesOpen ? "Hide Properties" : "Show Properties"}
                </button>
              </div>
            </div>

            <div style={{ height: "calc(100vh - 300px)" }}>
              <KanbanBoard
              tasks={(tasksData as any) ?? []}
              isLoading={isLoadingTasks}
              members={activeOrg?.members as any}
              onTaskStatusChange={async (taskId, newStatus) => {
                await updateTaskStatusMutation.mutateAsync({ id: taskId, featureId: id, status: newStatus });
              }}
              onTaskOrderChange={async (reorderedTasks) => {
                try {
                  // Loop through affected items in the background to preserve A3 router contract
                  await Promise.all(
                    reorderedTasks.map((item) =>
                      updateTaskOrderMutation.mutateAsync({ id: item.id, featureId: id, order: item.order })
                    )
                  );
                } catch (err) {
                  // Catch parallel mutation failures and throw a single error to prevent toast spam
                  throw new Error("Failed to update task order");
                }
              }}
              onTaskAssign={async (taskId, assigneeId, assignedToAI) => {
                await assignTaskMutation.mutateAsync({ id: taskId, featureId: id, assigneeId, assignedToAI });
              }}
              onSeedSampleTasks={async () => {
                toast.warning("No sample tasks here yet.");
              }}
            />
            </div>
          </div>
        );

      case "in_review":
        return (
          <div className="card p-8 border border-border bg-surface space-y-4">
            <div className="flex items-center gap-3">
              <GitMerge size={20} className="text-ink-tertiary flex-shrink-0" />
              <h3 className="text-lg font-semibold text-ink">AI review in progress</h3>
            </div>
            <p className="text-sm text-ink-secondary max-w-prose">
              Your pull request is being reviewed by AI. Results will appear here and in the Reviews tab once complete. No action needed.
            </p>
          </div>
        );

      case "ready_for_approval":
        return (
          <div className="space-y-8">
            <div className="card p-8 border border-border bg-surface space-y-6">
              <div className="flex items-center gap-3">
                <ShieldCheck
                  size={20}
                  className={isAdmin ? "text-accent flex-shrink-0" : "text-ink-tertiary flex-shrink-0"}
                />
                <h3 className="text-lg font-semibold text-ink">
                  {isAdmin ? "Ready for your approval" : "Ready for approval"}
                </h3>
              </div>
              <p className="text-sm text-ink-secondary max-w-prose">
                {isAdmin
                  ? "All engineering tasks are complete and the AI review has passed. Review the full checklist and ship when ready."
                  : "All checks passed. An admin will review and ship this feature. You'll be notified once it's live."}
              </p>
              {isAdmin && (
                <div>
                  <a
                    href={`/approvals/${feature.id}`}
                    className="btn btn-primary inline-flex items-center gap-2"
                  >
                    <CheckCircle2 size={16} /> Review &amp; approve
                  </a>
                </div>
              )}
            </div>
            <ApprovalTimeline featureId={feature.id} />
          </div>
        );

      case "shipped":
        return (
          <div className="space-y-8">
            <ShippedCelebration timeToShipDays={feature.timeToShipDays} />
            <ApprovalTimeline featureId={feature.id} />
          </div>
        );

      case "failed":
        return (
          <div className="card p-8 border border-border bg-surface space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-ink mb-2">
                We could not finish reviewing this request
              </h3>
              <p className="text-sm text-ink-secondary max-w-md">
                {feature.aiReasoning ?? "The intake workflow encountered an unexpected error. Please try again."}
              </p>
            </div>
            {isAdmin && (
              <RetryButton featureId={feature.id} onSuccess={refetchFeature} />
            )}
          </div>
        );

      case "rejected":
      case "out_of_scope":
        return (
          <div className="space-y-8">
            <div className="card p-8 border border-border bg-surface space-y-4">
              <h3 className="text-xl font-semibold text-ink">
                This idea will not move forward right now
              </h3>
              <p className="text-sm text-ink-secondary max-w-md">
                {feature.aiReasoning ?? "The team reviewed this request and decided not to continue with it."}
              </p>
            </div>
            {feature.status === "rejected" && <ApprovalTimeline featureId={feature.id} />}
          </div>
        );

      case "duplicate":
        return (
          <div className="card p-8 border border-border bg-surface space-y-4">
            <h3 className="text-xl font-semibold text-ink">Your team is already working on this</h3>
            <p className="text-sm text-ink-secondary max-w-md">
              {feature.aiReasoning ?? "This request closely matches an existing feature already in the pipeline."}
            </p>
          </div>
        );

      case "feature_exists":
        return (
          <div className="card p-8 border border-border bg-surface space-y-4">
            <h3 className="text-xl font-semibold text-ink">Good news — this may already be available</h3>
            <p className="text-sm text-ink-secondary max-w-md">
              {feature.aiReasoning ?? "This functionality may already exist in the product."}
            </p>
          </div>
        );

      case "bug_report":
        return (
          <div className="card p-8 border border-border bg-surface space-y-4">
            <h3 className="text-xl font-semibold text-ink">This looks like a bug report</h3>
            <p className="text-sm text-ink-secondary max-w-md">
              {feature.aiReasoning ?? "The team can triage it separately from feature planning."}
            </p>
          </div>
        );

      default:
        return (
          <div className="card p-12 text-center border border-border bg-surface">
            <p className="text-sm text-ink-secondary">Unknown status: {feature.status}</p>
          </div>
        );
    }
  };

  const getBadgeTier = (st: string) => {
    if (["received", "clarification_needed"].includes(st)) return "info";
    if (["analyzing", "prd_generating", "tasks_generating"].includes(st)) return "generating";
    if (["prd_ready", "tasks_ready", "in_development", "in_review", "ready_for_approval"].includes(st)) return "active";
    if (["shipped"].includes(st)) return "success";
    if (["fix_needed", "rejected"].includes(st)) return "warning";
    if (["failed"].includes(st)) return "error";
    return "neutral";
  };

  return (
    <div className="container-wide py-10">
      <button
        onClick={() => router.push("/dashboard")}
        className="btn btn-ghost mb-8 pl-0 text-ink-secondary hover:text-ink"
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <div className="mb-10 flex items-center justify-between border-b border-subtle pb-6">
        <div>
          <h1 className="text-3xl font-display text-ink mb-2">
            {feature.title ? feature.title.charAt(0).toUpperCase() + feature.title.slice(1) : ""}
          </h1>
          <p className="text-sm text-ink-tertiary font-mono">
            Request #{feature.id}
          </p>
        </div>
        <StatusBadge status={getStatusLabel(feature.status ?? "")} tier={getBadgeTier(feature.status ?? "") as any} />
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* CENTER (flex-1) */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          <div className="card p-4 border border-border bg-surface overflow-x-auto shrink-0">
            <PhaseStepper phases={phases} direction="horizontal" />
          </div>

          <Crossfade stateKey={`${feature.status}:${isEditingPrd ? "editing" : "view"}`}>
            {renderCenterContent()}
          </Crossfade>
        </div>

        {/* RIGHT (Properties Panel) */}
        {isPropertiesOpen && (
          <div className="w-full lg:w-80 flex-shrink-0">
            <div className="sticky top-8 card p-6 border border-border bg-surface space-y-6">
              <div className="flex items-center justify-between border-b border-subtle pb-3">
                <h3 className="text-label">Properties</h3>
                <button
                  onClick={() => setIsPropertiesOpen(false)}
                  className="btn btn-ghost p-1 h-auto"
                >
                  <X size={14} />
                </button>
              </div>

            <div className="space-y-4">
              <div>
                <span className="text-label block mb-1">Submitted By</span>
                <div className="flex items-center gap-2 text-sm text-ink-secondary">
                  <User size={14} className="text-ink-tertiary" />
                  <span className="truncate">
                    {feature.submitterName || feature.submitterEmail || "Anonymous (Portal)"}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-label block mb-1">Source</span>
                <div className="text-sm font-mono text-ink-secondary">
                  {feature.source || "portal"}
                </div>
              </div>

              <div>
                <span className="text-label block mb-1">Created Date</span>
                <div className="flex items-center gap-2 text-sm text-ink-secondary">
                  <Clock size={14} className="text-ink-tertiary" />
                  <span>
                    {feature.createdAt ? parseDbTimestamp(feature.createdAt)?.toLocaleDateString() : "N/A"}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-label block mb-1">Project / Workspace</span>
                <div className="flex items-center gap-2 text-sm text-ink-secondary">
                  <Folder size={14} className="text-ink-tertiary" />
                  <span className="truncate">{activeOrg?.name || "Claire Core"}</span>
                </div>
              </div>

              <div>
                <span className="text-label block mb-1">Linked Pull Request</span>
                <div>
                  {(feature as any).pullRequests?.[0] ? (
                    <a
                      href={(feature as any).pullRequests[0].url ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-accent hover:underline"
                    >
                      <GitPullRequest size={14} />
                      <span>
                        {(feature as any).pullRequests[0].repository?.name ?? "repo"}#
                        {(feature as any).pullRequests[0].number}
                      </span>
                      <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span className="text-xs font-mono text-ink-tertiary">None linked</span>
                  )}
                </div>
              </div>
            </div>

            {isAdmin ? (
              <div className="pt-4 border-t border-subtle text-2xs font-mono text-accent">
                Admin Mode (Editable properties enabled)
              </div>
            ) : (
              <div className="pt-4 border-t border-subtle text-2xs font-mono text-ink-tertiary">
                Member Mode (Read-only properties)
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
