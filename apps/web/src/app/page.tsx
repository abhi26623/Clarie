"use client";
import { useSession } from "@shipflow/auth/client";

export default function Home() {
  const { data: session, isPending } = useSession();

  return (
    <main className="container">
      <span className="badge">ShipFlow AI</span>
      <h1 style={{ fontSize: 40, margin: "16px 0", letterSpacing: -1 }}>
        From feature request to shipped.
      </h1>
      <p className="muted" style={{ maxWidth: 520 }}>
        An AI reviewer that judges code against product requirements, plus a live,
        visible workflow. This is the scaffold spine.
      </p>
      <div className="row" style={{ marginTop: 24 }}>
        {isPending ? (
          <span className="muted">Loading...</span>
        ) : session ? (
          <a className="btn" href="/dashboard">Go to dashboard</a>
        ) : (
          <>
            <a className="btn" href="/sign-in">Sign In</a>
            <a className="badge" href="/sign-up" style={{ padding: "10px 16px" }}>Sign Up</a>
          </>
        )}
        <a className="badge" href="/p/demo-org" style={{ padding: "10px 16px" }}>Public portal demo</a>
      </div>
      <p className="muted" style={{ marginTop: 24, fontSize: 13 }}>
        Health check: <a href="/api/trpc/health?batch=1&input=%7B%7D">/api/trpc/health</a>
      </p>
    </main>
  );
}
