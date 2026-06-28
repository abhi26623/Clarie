"use client";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

const TERMINAL = ["done", "failed"];

export default function Portal({ params }: { params: { slug: string } }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [requestId, setRequestId] = useState<number | null>(null);

  const submit = trpc.submitFeature.useMutation({
    onSuccess: (r) => setRequestId(r.id),
  });

  // Poll live workflow steps once we have an id.
  const steps = trpc.steps.useQuery(
    { entityType: "feature_request", entityId: String(requestId) },
    { enabled: requestId !== null, refetchInterval: (q) => {
        const rows = q.state.data ?? [];
        const last = rows[0];
        return last && TERMINAL.includes(last.status) ? false : 1200;
      } },
  );

  const rows = steps.data ?? [];
  const settled = rows[0] && TERMINAL.includes(rows[0].status);

  return (
    <main className="container" style={{ maxWidth: 640 }}>
      <span className="badge">{params.slug}</span>
      <h1 style={{ fontSize: 30, margin: "12px 0" }}>Suggest a feature</h1>
      <p className="muted">Tell us what would make this better. We will read it instantly.</p>

      {requestId === null && (
        <div className="card" style={{ marginTop: 20, display: "grid", gap: 14 }}>
          <div>
            <label>Your idea (short title)</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Dark mode" />
          </div>
          <div>
            <label>Details</label>
            <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What should it do and why?" />
          </div>
          <button
            className="btn"
            disabled={submit.isPending || title.length < 3 || body.length < 3}
            onClick={() => submit.mutate({ organizationId: params.slug, title, body })}
          >
            {submit.isPending ? "Sending…" : "Submit idea"}
          </button>
        </div>
      )}

      {requestId !== null && (
        <div className="card" style={{ marginTop: 20 }}>
          <strong>Watching it think</strong>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {rows.length === 0 && <div className="pulse muted">Starting…</div>}
            {[...rows].reverse().map((s) => (
              <div key={s.id} className="row" style={{ justifyContent: "space-between" }}>
                <span className={s.status === "running" ? "pulse" : ""}>
                  {(s.partialResult as any)?.label ?? s.step}
                </span>
                <span className="badge">{s.status}</span>
              </div>
            ))}
            {!settled && rows.length > 0 && <div className="pulse muted">Working…</div>}
            {settled && rows[0].status === "failed" && (
              <div className="card" style={{ borderColor: "#5a2330" }}>
                {(rows[0].partialResult as any)?.message ?? "Something went wrong."}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
