"use client";
import { useState, useEffect, Suspense } from "react";
import { trpc } from "@/lib/trpc";
import { authClient } from "@claire/auth/client";
import { useRouter, useSearchParams } from "next/navigation";
import { StatusBadge, Crossfade } from "@claire/ui";
import { toast } from "sonner";

type UIState = "form" | "progress" | "clarification" | "exists" | "duplicate" | "bug" | "success" | "failed" | "out_of_scope";

const TERMINAL = [
  "prd_ready", "tasks_generating", "tasks_ready", "in_development",
  "in_review", "fix_needed", "ready_for_approval", "shipped",
  "duplicate", "feature_exists", "bug_report", "out_of_scope",
  "accepted", "rejected", "failed"
];

function statusToUIState(status: string): UIState {
  if (["received", "analyzing", "prd_generating", "accepted"].includes(status)) return "progress";
  if (status === "clarification_needed") return "clarification";
  if (status === "feature_exists") return "exists";
  if (status === "duplicate") return "duplicate";
  if (status === "bug_report") return "bug";
  if (status === "out_of_scope") return "out_of_scope";
  if (["prd_ready", "tasks_generating", "tasks_ready", "in_development",
       "in_review", "fix_needed", "ready_for_approval", "shipped"].includes(status)) return "success";
  if (["rejected", "failed"].includes(status)) return "failed";
  return "progress";
}

function PortalContent({ slug }: { slug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestParam = searchParams.get("request");

  const [uiState, setUiState] = useState<UIState>("form");
  const [canViewDashboard, setCanViewDashboard] = useState(false);
  const [trackingToken, setTrackingToken] = useState<string | null>(requestParam);
  const [requestId, setRequestId] = useState<number | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Clarification state
  const [clarificationAnswer, setClarificationAnswer] = useState("");

  // Queries
  const { data: publicTracking, refetch: refetchTracking } = trpc.feature.getPublicTracking.useQuery(
    { portalSlug: slug, trackingToken: trackingToken! },
    { 
      enabled: !!trackingToken && uiState !== "form",
      refetchInterval: (query) => {
        const data = query.state.data;
        if (!data) return 1200;
        if (TERMINAL.includes(data.status)) return false;
        if (data.status === "clarification_needed" && data.clarificationQuestion) return false;
        return 1200;
      }
    }
  );

  const { data: stepsData } = trpc.workflow.getStepsByToken.useQuery(
    { trackingToken: trackingToken ?? "" },
    { 
      enabled: !!trackingToken, 
      refetchInterval: () => {
        if (!publicTracking) return 1200;
        if (TERMINAL.includes(publicTracking.status)) return false;
        if (publicTracking.status === "clarification_needed" && publicTracking.clarificationQuestion) return false;
        return 1200;
      }
    }
  );

  // Drive uiState directly from publicTracking on every poll tick.
  // This is the source of truth — step rows alone are not sufficient
  // because a retried job can leave stale "failed" step rows even after
  // the feature reaches prd_ready. Reading status here means the portal
  // exits the "progress" view as soon as the DB status becomes terminal,
  // regardless of leftover step rows.
  useEffect(() => {
    if (!publicTracking) return;
    setRequestId(publicTracking.id);
    setAiReasoning(publicTracking.aiReasoning);
    const newState = statusToUIState(publicTracking.status);
    // Allow backwards transition only out of "form"; once we've left form,
    // only allow forward progression (never go back to "progress" from a terminal state).
    setUiState((prev) => {
      if (prev === "form") return newState;
      // Terminal states win — once reached, never regress to "progress"
      const terminalStates: UIState[] = ["clarification", "exists", "duplicate", "bug", "success", "failed", "out_of_scope"];
      if (terminalStates.includes(prev)) return prev;
      return newState;
    });
  }, [publicTracking]);


  // Mutations
  const submit = trpc.feature.submit.useMutation({
    onSuccess: (r) => {
      setRequestId(r.id);
      setTrackingToken(r.trackingToken);
      setCanViewDashboard(r.canViewDashboard);
      setOrgId(r.organizationId);
      router.replace(`/p/${slug}?request=${r.trackingToken}`);
      setUiState("progress");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to submit request");
    },
  });

  const handleSendIdea = () => {
    if (email.trim().length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        toast.error("Enter a valid email, or leave it blank");
        return;
      }
    }
    submit.mutate({
      portalSlug: slug,
      title,
      body,
      submitterName: name.trim() || undefined,
      submitterEmail: email.trim() || undefined,
    });
  };

  const answerClarification = trpc.feature.answerPublicClarification.useMutation({
    onSuccess: async () => {
      await refetchTracking();
      setUiState("progress");
      setClarificationAnswer("");
    },
  });

  const resetForm = () => {
    setTitle("");
    setBody("");
    setName("");
    setEmail("");
    setTrackingToken(null);
    setRequestId(null);
    setUiState("form");
    router.replace(`/p/${slug}`);
  };

  // Workflow steps: keep only the latest row per logical step name (handles any
  // legacy duplicate rows), then filter out stale "failed" rows when the overall
  // feature has reached a success-terminal state (prd_ready, clarification_needed,
  // duplicate, feature_exists, bug_report, out_of_scope). Raw internal error
  // labels are never shown to public portal users.
  const SUCCESS_TERMINAL = [
    "prd_ready", "clarification_needed", "duplicate", "feature_exists",
    "bug_report", "out_of_scope", "accepted",
  ];
  const featureIsSuccessTerminal = publicTracking
    ? SUCCESS_TERMINAL.includes(publicTracking.status)
    : false;

  const rows = stepsData ?? [];
  const latestByStep = Object.values(
    rows.reduce((acc, s) => {
      const sTime = s.createdAt ?? "";
      const accTime = acc[s.step]?.createdAt ?? "";
      if (!acc[s.step] || sTime > accTime) acc[s.step] = s;
      return acc;
    }, {} as Record<string, typeof rows[number]>)
  )
    // On a success-terminal outcome, hide any leftover failed rows from mid-retry
    .filter((s) => !(featureIsSuccessTerminal && s.status === "failed"))
    // Sort by insertion time for logical ordering
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));

  // Sanitize labels: never show raw internal error strings to public users
  function safeLabel(s: typeof rows[number]): string {
    const raw = (s.partialResult as any)?.label ?? s.step;
    if (s.status === "failed") return "We could not finish reviewing this idea";
    return raw;
  }

  const settled = publicTracking ? TERMINAL.includes(publicTracking.status) : false;

  return (
    <main className="container" style={{ maxWidth: 640 }}>
      <Crossfade stateKey={uiState}>
        {uiState === "form" && (
          <div className="portal-form">
            <div>
              <span className="badge" style={{ backgroundColor: "var(--accent-subtle)", color: "var(--accent-text)" }}>
                {slug}
              </span>
            </div>
            <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2.25rem)", textWrap: "balance", margin: "0 0 4px", fontFamily: "var(--font-display)" }}>
              Suggest a feature
            </h1>
            <p className="muted" style={{ marginBottom: 12 }}>Tell us what would make this better. We will read it instantly.</p>
            
            <div className="card" style={{ padding: 24, display: "grid", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label>Your name (optional)</label>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
                </div>
                <div>
                  <label>Email (optional)</label>
                  <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
                </div>
              </div>
              <div>
                <label>Your idea (short title)</label>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Dark mode" />
              </div>
              <div>
                <label>Details</label>
                <textarea className="input" rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What should it do and why?" />
              </div>
              <button
                className="btn"
                disabled={submit.isPending || title.length < 3}
                onClick={handleSendIdea}
                style={{ justifySelf: "start" }}
              >
                {submit.isPending ? "Sending…" : "Send idea →"}
              </button>
            </div>
            <div className="portal-footer">Powered by Claire</div>
          </div>
        )}

        {uiState === "progress" && (
          <div className="portal-form">
            <h1 style={{ fontSize: 24, margin: "0 0 16px", fontFamily: "var(--font-display)" }}>Watching it think</h1>
            <div className="card" style={{ padding: 24, display: "grid", gap: 12 }}>
              {latestByStep.length === 0 && <div className="pulse muted">Starting…</div>}
              {latestByStep.map((s) => (
                <div key={s.id} className="portal-step">
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span className={`portal-step--${s.status}`} />
                    <span>{safeLabel(s)}</span>
                  </div>
                  <StatusBadge status={s.status} tier={s.status === "running" ? "info" : s.status === "failed" ? "error" : "success"} />
                </div>
              ))}
              {/* Only show "Working…" while still in-flight — never once settled */}
              {!settled && latestByStep.length > 0 && latestByStep.every((s) => s.status !== "failed") && (
                <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
                  <span className="portal-step--running" />
                  <span className="muted">Working…</span>
                </div>
              )}
            </div>
          </div>
        )}

        {uiState === "clarification" && publicTracking && (
          <div className="portal-form">
            <h1 style={{ fontSize: 24, margin: "0 0 8px", fontFamily: "var(--font-display)" }}>The team needs one more detail.</h1>
            <div className="card" style={{ padding: 24 }}>
              {publicTracking.clarificationQuestion ? (
                <>
                  <p style={{ marginBottom: 20 }}>{publicTracking.clarificationQuestion}</p>
                  
                  {publicTracking.clarificationQuestionType === "TEXT" && (
                    <textarea className="input" rows={4} value={clarificationAnswer} onChange={(e) => setClarificationAnswer(e.target.value)} placeholder="Your answer..." style={{ marginBottom: 16 }} />
                  )}
                  
                  {publicTracking.clarificationQuestionType === "CHOICE" && publicTracking.clarificationOptions && (
                    <div style={{ marginBottom: 16 }}>
                      {publicTracking.clarificationOptions.map((opt) => (
                        <label key={opt} className="clarification-choice">
                          <input type="radio" name="clarification" value={opt} checked={clarificationAnswer === opt} onChange={() => setClarificationAnswer(opt)} style={{ marginRight: 8 }} />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {publicTracking.clarificationQuestionType === "YESNO" && (
                    <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                      <button className={`btn ${clarificationAnswer === "Yes" ? "" : "btn--outline"}`} onClick={() => setClarificationAnswer("Yes")}>Yes</button>
                      <button className={`btn ${clarificationAnswer === "No" ? "" : "btn--outline"}`} onClick={() => setClarificationAnswer("No")}>No</button>
                    </div>
                  )}

                  <button
                    className="btn"
                    disabled={answerClarification.isPending || clarificationAnswer.length === 0}
                    onClick={() => answerClarification.mutate({ 
                      portalSlug: slug, 
                      trackingToken: trackingToken!, 
                      clarificationThreadId: publicTracking.clarificationThreadId!, 
                      answer: clarificationAnswer 
                    })}
                  >
                    {answerClarification.isPending ? "Submitting…" : "Submit answer"}
                  </button>
                </>
              ) : (
                <p className="muted">We&apos;ll follow up by email.</p>
              )}
            </div>
          </div>
        )}

        {uiState === "exists" && (
          <div className="portal-form">
            <h1 style={{ fontSize: 24, margin: "0 0 8px", fontFamily: "var(--font-display)" }}>Good news — this may already be available.</h1>
            <div className="card" style={{ padding: 24 }}>
              {aiReasoning && <p style={{ marginBottom: 20 }}>{aiReasoning}</p>}
              <button className="btn btn--outline" onClick={resetForm}>Submit something different →</button>
            </div>
          </div>
        )}

        {uiState === "duplicate" && (
          <div className="portal-form">
            <h1 style={{ fontSize: 24, margin: "0 0 8px", fontFamily: "var(--font-display)" }}>Your team is already working on this.</h1>
            <div className="card" style={{ padding: 24 }}>
              {aiReasoning && <p style={{ marginBottom: 20 }}>{aiReasoning}</p>}
              <button className="btn" onClick={() => router.push(`/p/${slug}/r/${trackingToken}`)}>Track this request →</button>
            </div>
          </div>
        )}

        {uiState === "bug" && (
          <div className="portal-form">
            <h1 style={{ fontSize: 24, margin: "0 0 8px", fontFamily: "var(--font-display)" }}>This has been logged as a bug report.</h1>
            <div className="card" style={{ padding: 24 }}>
              <button className="btn btn--outline" onClick={resetForm}>Submit something different →</button>
            </div>
          </div>
        )}

        {uiState === "out_of_scope" && (
          <div className="portal-form">
            <h1 style={{ fontSize: 24, margin: "0 0 8px", fontFamily: "var(--font-display)" }}>This falls outside the current product scope.</h1>
            <div className="card" style={{ padding: 24 }}>
              <button className="btn btn--outline" onClick={resetForm}>Submit something different →</button>
            </div>
          </div>
        )}

        {uiState === "success" && (
          <div className="portal-form">
            <h1 style={{ fontSize: 24, margin: "0 0 8px", fontFamily: "var(--font-display)" }}>
              {canViewDashboard ? "Your request is in review." : "Request received."}
            </h1>
            <div className="card" style={{ padding: 24 }}>
              {!canViewDashboard && <p className="muted" style={{ marginBottom: 20 }}>We&apos;ll email you when it moves forward.</p>}
              
              {canViewDashboard ? (
                <button 
                  className="btn" 
                  onClick={async () => {
                    if (orgId) await authClient.organization.setActive({ organizationId: orgId });
                    router.push("/dashboard");
                  }}
                >
                  View in dashboard →
                </button>
              ) : (
                <button className="btn" onClick={() => router.push(`/p/${slug}/r/${trackingToken}`)}>
                  Track your request →
                </button>
              )}
            </div>
          </div>
        )}

        {uiState === "failed" && (
          <div className="portal-form">
            <h1 style={{ fontSize: 24, margin: "0 0 8px", fontFamily: "var(--font-display)" }}>Something went wrong.</h1>
            <div className="card" style={{ padding: 24, borderColor: "var(--status-error-border)" }}>
              <p style={{ marginBottom: 20 }}>Your request was submitted, but we ran into a problem. Try again or contact the team.</p>
              <button className="btn" onClick={resetForm}>Try again</button>
            </div>
          </div>
        )}
      </Crossfade>
    </main>
  );
}

export default function PortalPage({ params }: { params: { slug: string } }) {
  return (
    <Suspense fallback={<div className="container pulse muted">Loading...</div>}>
      <PortalContent slug={params.slug} />
    </Suspense>
  );
}
