"use client";
import { trpc } from "@/lib/trpc";
import { useSession, signOut } from "@claire/auth/client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const STAGES = ["received", "accepted", "in_development", "in_review", "ready_for_approval", "shipped"];

export default function Dashboard() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const { data, isLoading: dataLoading } = trpc.listRequests.useQuery();

  const isLoading = sessionLoading || dataLoading;

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push("/sign-in");
    }
  }, [session, sessionLoading, router]);

  if (sessionLoading) {
    return <main className="container"><div className="card pulse">Loading session...</div></main>;
  }

  if (!session) {
    return null; // Next.js will handle the redirect via useEffect
  }

  return (
    <main className="container">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 28 }}>Dashboard</h1>
        <div className="row">
          <span className="muted" style={{ fontSize: 13 }}>{session.user.email}</span>
          <button className="badge" style={{ cursor: "pointer" }} onClick={() => signOut({ fetchOptions: { onSuccess: () => router.push("/") } })}>
            Sign Out
          </button>
        </div>
      </div>

      <div className="row" style={{ flexWrap: "wrap", marginTop: 16 }}>
        {STAGES.map((s) => (
          <div key={s} className="card" style={{ flex: 1, minWidth: 130 }}>
            <div className="muted" style={{ fontSize: 12 }}>{s.replace(/_/g, " ")}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>
              {data?.filter((r) => r.status === s).length ?? 0}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, display: "grid", gap: 10 }}>
        {isLoading && <div className="card pulse">Loading requests…</div>}
        {!isLoading && (!data || data.length === 0) && (
          <div className="card">
            <strong>No requests yet.</strong>
            <p className="muted">Sign in, create a workspace, then submit one from the public portal.</p>
          </div>
        )}
        {data?.map((r) => (
          <div key={r.id} className="card row" style={{ justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 600 }}>{r.title}</div>
              <div className="muted" style={{ fontSize: 13 }}>{r.body.slice(0, 80)}</div>
            </div>
            <span className="badge">{r.status.replace(/_/g, " ")}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
