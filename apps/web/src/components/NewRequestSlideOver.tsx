"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { SlideOver } from "@claire/ui";
import { ArrowRight, CheckCircle2, AlertCircle, HelpCircle, FileText, Clock, Loader2 } from "lucide-react";

// Statuses at which we stop polling — the pipeline has reached a final state
// for the "new request" intake flow.
const INTAKE_TERMINAL_STATUSES = new Set([
  "prd_ready",
  "clarification_needed",
  "duplicate",
  "feature_exists",
  "out_of_scope",
  "bug_report",
  "failed",
]);

// Map each status to its position in the pipeline so we can derive which
// checklist steps are complete vs. in-progress vs. pending.
const STATUS_ORDER: Record<string, number> = {
  received:             0,
  analyzing:            1,
  clarification_needed: 2,
  accepted:             2,
  duplicate:            2,
  feature_exists:       2,
  out_of_scope:         2,
  bug_report:           2,
  failed:               2,
  prd_generating:       3,
  prd_ready:            4,
};

type StepState = "done" | "active" | "pending";

interface PipelineStep {
  id: string;
  label: string;
  state: StepState;
}

function deriveSteps(status: string | undefined): PipelineStep[] {
  const normalized = status ? status.toLowerCase() : "";
  const order = normalized ? (STATUS_ORDER[normalized] ?? 0) : 0;

  const raw: Array<{ id: string; label: string; threshold: number }> = [
    { id: "received",  label: "Request received",        threshold: 0 },
    { id: "analyzing", label: "AI analysing request",    threshold: 1 },
    { id: "classify",  label: "Classifying & triaging",  threshold: 2 },
    { id: "prd",       label: "Generating product spec", threshold: 3 },
    { id: "ready",     label: "Plan ready",              threshold: 4 },
  ];

  return raw.map((s) => ({
    id: s.id,
    label: s.label,
    state:
      order > s.threshold
        ? "done"
        : order === s.threshold
        ? "active"
        : "pending",
  }));
}

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

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Set once the feature is created; drives the polling query
  const [newFeatureId, setNewFeatureId] = useState<number | null>(null);

  // ─── Safety timeout ──────────────────────────────────────────────────────────
  // If polling runs for >3 minutes without reaching a terminal state, stop it
  // and surface a non-blocking nudge to track progress on the detail page.
  const [isTimedOut, setIsTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Arm the timeout when a new feature ID is set
    if (newFeatureId && !isTerminal) {
      timeoutRef.current = setTimeout(() => {
        setIsTimedOut(true);
      }, 3 * 60 * 1000); // 3 minutes
    }
    // Clear the timeout when polling is no longer needed
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newFeatureId]); // Re-arm only on new submission, not on every status change

  const submitMutation = trpc.feature.submit.useMutation();

  // ─── Polling query ───────────────────────────────────────────────────────────
  // refetchInterval is the ONLY live-update mechanism. No setInterval, no SSE.
  // Polls every 2 s while the status is non-terminal, then stops automatically.
  const { data: featureData } = trpc.feature.getById.useQuery(
    { id: newFeatureId ?? 0 },
    {
      enabled: !!newFeatureId,
      staleTime: 0,                       // always treat cached data as stale
      refetchOnWindowFocus: true,
      refetchIntervalInBackground: false, // pause polling when the tab is hidden
      refetchInterval: (query) => {
        if (isTimedOut) return false;      // safety timeout hit — stop polling
        const status = query.state.data?.status?.toLowerCase();
        if (!status || INTAKE_TERMINAL_STATUSES.has(status)) return false;
        return 2000;
      },
    }
  );

  const currentStatus = featureData?.status?.toLowerCase();
  const isTerminal = currentStatus ? INTAKE_TERMINAL_STATUSES.has(currentStatus) : false;

  // Derive checklist from polled status — no workflow.getSteps needed
  const steps = useMemo(() => deriveSteps(currentStatus), [currentStatus]);

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setTitle("");
    setBody("");
    setSubmitterName("");
    setSubmitterEmail("");
    setErrorMessage("");
    setNewFeatureId(null);
    setIsTimedOut(false);  // clear timeout state on reset so next submission starts fresh
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleClose = () => {
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
      if (onCreated) onCreated();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to generate plan.");
    }
  };

  const navigateToFeature = () => {
    if (!newFeatureId) return;
    router.push(`/requests/${newFeatureId}`);
    handleClose();
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
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
          /* ── LIVE WORKFLOW PROGRESS VIEW ─────────────────────────────── */
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

                {/* Status-derived step checklist — updates as polling returns new status */}
                <ol className="space-y-3">
                  {steps.map((step) => (
                    <li key={step.id} className="flex items-center gap-3">
                      <span className="flex-shrink-0">
                        {step.state === "done" && (
                          <CheckCircle2 size={18} className="text-status-success-fg" />
                        )}
                        {step.state === "active" && (
                          <Loader2 size={18} className="text-ink-secondary animate-spin" />
                        )}
                        {step.state === "pending" && (
                          <Clock size={18} className="text-ink-tertiary opacity-40" />
                        )}
                      </span>
                      <span
                        className={`text-sm ${
                          step.state === "done"
                            ? "text-ink line-through decoration-ink-tertiary"
                            : step.state === "active"
                            ? "text-ink font-medium"
                            : "text-ink-tertiary"
                        }`}
                      >
                        {step.label}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Terminal result card */}
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
            ) : isTimedOut ? (
              /* Timeout nudge — non-blocking, just suggests the detail page */
              <div className="p-4 bg-canvas border border-subtle rounded-md space-y-3">
                <p className="text-xs text-ink-secondary font-mono text-center">
                  This is taking longer than expected — you can track it on the request page.
                </p>
                {newFeatureId && (
                  <button
                    onClick={navigateToFeature}
                    className="btn btn-primary w-full justify-center py-2.5 text-sm font-medium"
                  >
                    View request <ArrowRight size={16} className="ml-2" />
                  </button>
                )}
              </div>
            ) : (
              <div className="p-4 bg-canvas border border-subtle rounded-md text-center text-xs text-ink-tertiary font-mono">
                AI is currently processing your request…
              </div>
            )}
          </div>
        ) : (
          /* ── NEW REQUEST FORM ────────────────────────────────────────── */
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
// cache bust 1
