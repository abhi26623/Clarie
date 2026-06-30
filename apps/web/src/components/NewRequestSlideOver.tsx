"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { SlideOver, WorkflowProgress, PhaseStep } from "@claire/ui";
import { WORKFLOW_ENTITY_FEATURE } from "@claire/api/constants";
import { ArrowRight, CheckCircle2, AlertCircle, HelpCircle, FileText, ExternalLink } from "lucide-react";

const INTAKE_TERMINAL_STATUSES = [
  "prd_ready",
  "clarification_needed",
  "duplicate",
  "feature_exists",
  "out_of_scope",
  "bug_report",
  "failed",
];

export function NewRequestSlideOver({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const router = useRouter();

  // Form states
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Submission & Polling state
  const [newFeatureId, setNewFeatureId] = useState<number | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const submitMutation = trpc.feature.submit.useMutation();

  // Polling queries
  const { data: featureData, refetch: refetchFeature, isError: isFeatureError } = trpc.feature.getById.useQuery(
    { id: newFeatureId ?? 0 },
    {
      enabled: !!newFeatureId,
      refetchInterval: isPolling ? 1000 : false,
    }
  );

  const { data: workflowStepsData, refetch: refetchWorkflow } = trpc.workflow.getSteps.useQuery(
    { entityType: WORKFLOW_ENTITY_FEATURE, entityId: String(newFeatureId ?? 0) },
    {
      enabled: !!newFeatureId,
      refetchInterval: isPolling ? 1000 : false,
    }
  );

  // Evaluate terminal status
  const currentStatus = featureData?.status;
  const isTerminal = currentStatus ? INTAKE_TERMINAL_STATUSES.includes(currentStatus) : false;

  // Explicitly clear interval / stop polling on terminal status, query error, on close, and on unmount
  useEffect(() => {
    if (!isOpen || isTerminal || isFeatureError) {
      setIsPolling(false);
      return;
    }

    let interval: NodeJS.Timeout | null = null;
    if (isPolling && newFeatureId && !isTerminal && !isFeatureError) {
      interval = setInterval(() => {
        refetchFeature();
        refetchWorkflow();
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isOpen, isTerminal, isFeatureError, isPolling, newFeatureId, refetchFeature, refetchWorkflow]);

  const handleReset = () => {
    setTitle("");
    setBody("");
    setSubmitterName("");
    setSubmitterEmail("");
    setErrorMessage("");
    setNewFeatureId(null);
    setIsPolling(false);
  };

  const handleClose = () => {
    setIsPolling(false);
    handleReset();
    onClose();
  };

  const handleGeneratePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!title.trim() || !body.trim()) {
      setErrorMessage("Title and description are required.");
      return;
    }

    try {
      const result = await submitMutation.mutateAsync({
        title: title.trim(),
        body: body.trim(),
        submitterName: submitterName.trim() || undefined,
        submitterEmail: submitterEmail.trim() || undefined,
      });

      setNewFeatureId(result.id);
      setIsPolling(true);
      if (onCreated) onCreated();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to generate plan.");
    }
  };

  // Map workflow steps to UI primitive format
  const steps: PhaseStep[] = useMemo(() => {
    if (!workflowStepsData) return [];
    return workflowStepsData.map((s: any) => ({
      id: String(s.id),
      label: (s.partialResult as any)?.label || s.step,
      state: s.status === "done" ? "done" : s.status === "failed" ? "done" : "active",
      meta: s.durationMs ? `${s.durationMs}ms` : undefined,
      isStatusInFlight: s.status === "running",
    }));
  }, [workflowStepsData]);

  const navigateToFeature = () => {
    if (!newFeatureId) return;
    setIsPolling(false);
    router.push(`/requests/${newFeatureId}`);
    handleClose();
  };

  return (
    <SlideOver isOpen={isOpen} onClose={handleClose} title="New Feature Request">
      <div className="flex flex-col h-full p-8 overflow-y-auto bg-surface text-ink space-y-8">
        <div className="border-b border-subtle pb-4">
          <h2 className="text-2xl font-display text-ink mb-1">New Request</h2>
          <p className="text-xs text-ink-secondary">
            Submit a feature idea or problem statement. Claire AI will classify and generate a plan.
          </p>
        </div>

        {newFeatureId ? (
          /* LIVE WORKFLOW PROGRESS VIEW */
          <div className="space-y-8 flex-1 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="p-4 bg-surface-raised border border-border rounded-lg space-y-2">
                <div className="text-xs font-mono text-ink-tertiary">Request #{newFeatureId}</div>
                <h3 className="text-lg font-medium text-ink">{title}</h3>
              </div>

              <div>
                <h4 className="text-xs font-mono uppercase tracking-wider text-ink-secondary mb-4">
                  Live AI Execution
                </h4>
                <WorkflowProgress steps={steps} />
              </div>
            </div>

            {/* TERMINAL STATUS HANDLING */}
            {isTerminal ? (
              <div className="p-6 bg-surface-raised border border-border-strong rounded-lg space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center gap-3">
                  {currentStatus === "prd_ready" && <CheckCircle2 size={24} className="text-status-success-fg" />}
                  {currentStatus === "clarification_needed" && <HelpCircle size={24} className="text-status-warning-fg" />}
                  {["duplicate", "feature_exists"].includes(currentStatus || "") && <FileText size={24} className="text-status-neutral-fg" />}
                  {["out_of_scope", "bug_report", "failed"].includes(currentStatus || "") && <AlertCircle size={24} className="text-status-error-fg" />}

                  <span className="text-base font-medium text-ink">
                    {currentStatus === "prd_ready" && "Plan ready"}
                    {currentStatus === "clarification_needed" && "Claire needs one more detail"}
                    {currentStatus === "duplicate" && "This may already be in progress"}
                    {currentStatus === "feature_exists" && "This may already be available"}
                    {currentStatus === "out_of_scope" && "Request is out of scope"}
                    {currentStatus === "bug_report" && "Classified as a bug report"}
                    {currentStatus === "failed" && "Analysis failed"}
                  </span>
                </div>

                <p className="text-xs text-ink-secondary">
                  {currentStatus === "prd_ready" && "Product requirements document has been successfully compiled."}
                  {currentStatus === "clarification_needed" && "A clarifying question has been generated to ensure complete requirements."}
                  {["duplicate", "feature_exists"].includes(currentStatus || "") && "Review the existing feature request or documentation."}
                  {["out_of_scope", "bug_report", "failed"].includes(currentStatus || "") && "The request has been triaged accordingly."}
                </p>

                <button
                  onClick={navigateToFeature}
                  className="btn btn-primary w-full justify-center py-3 text-sm font-medium mt-2"
                >
                  {currentStatus === "prd_ready" && "View feature detail"}
                  {currentStatus === "clarification_needed" && "Answer question"}
                  {!["prd_ready", "clarification_needed"].includes(currentStatus || "") && "View request"}
                  <ArrowRight size={16} className="ml-2" />
                </button>
              </div>
            ) : (
              <div className="p-4 bg-canvas border border-subtle rounded-md text-center text-xs text-ink-tertiary font-mono">
                AI is currently processing your request...
              </div>
            )}
          </div>
        ) : (
          /* NEW REQUEST FORM */
          <form onSubmit={handleGeneratePlan} className="space-y-6 flex-1 flex flex-col justify-between">
            <div className="space-y-5">
              {errorMessage && (
                <div className="p-3 bg-status-error-bg border border-status-error-border text-status-error-fg rounded text-xs font-mono">
                  {errorMessage}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-ink-secondary uppercase tracking-wider font-mono">
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Custom Webhook Integrations"
                  disabled={submitMutation.isPending}
                  className="input w-full p-3 text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-ink-secondary uppercase tracking-wider font-mono">
                  Problem / Request Description *
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Describe the problem, use case, or desired functionality in detail..."
                  disabled={submitMutation.isPending}
                  className="input w-full min-h-[160px] p-3 text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-ink-secondary uppercase tracking-wider font-mono">
                  Optional Submitter Name
                </label>
                <input
                  type="text"
                  value={submitterName}
                  onChange={(e) => setSubmitterName(e.target.value)}
                  placeholder="Jane Doe"
                  disabled={submitMutation.isPending}
                  className="input w-full p-3 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-ink-secondary uppercase tracking-wider font-mono">
                  Optional Submitter Email
                </label>
                <input
                  type="email"
                  value={submitterEmail}
                  onChange={(e) => setSubmitterEmail(e.target.value)}
                  placeholder="jane@example.com"
                  disabled={submitMutation.isPending}
                  className="input w-full p-3 text-sm"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-subtle">
              <button
                type="submit"
                disabled={submitMutation.isPending}
                className="btn btn-primary w-full justify-center py-3.5 text-base font-medium"
              >
                {submitMutation.isPending ? "Generating…" : "Generate plan"}
              </button>
            </div>
          </form>
        )}
      </div>
    </SlideOver>
  );
}
