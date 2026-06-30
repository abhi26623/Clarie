"use client";
export const dynamic = "force-dynamic";
import { useState } from "react";
import { signUp, signIn } from "@claire/auth/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function SignUp() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  // Use a local URL search params reader to avoid Next.js 14 full page deopt
  const getReturnTo = () => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("returnTo");
    }
    return null;
  };

  const handleGitHubSignUp = async () => {
    setLoading(true);
    const returnTo = getReturnTo();
    if (returnTo && returnTo.startsWith("/join/")) {
      document.cookie = `returnTo=${returnTo}; path=/; max-age=3600;`;
    }
    await signIn.social({
      provider: "github",
      callbackURL: "/api/auth/route-destination",
      fetchOptions: {
        onError: (ctx) => {
          toast.error(ctx.error.message);
          setLoading(false);
        },
      }
    });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const returnTo = getReturnTo();
    if (returnTo && returnTo.startsWith("/join/")) {
      document.cookie = `returnTo=${returnTo}; path=/; max-age=3600;`;
    }
    await signUp.email({
      name,
      email,
      password,
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/api/auth/route-destination";
        },
        onError: (ctx) => {
          toast.error(ctx.error.message);
          setLoading(false);
        },
      }
    });
  };
  return (
    <main className="container" style={{ maxWidth: 400, marginTop: 80 }}>
      <div className="card">
        <h1 style={{ fontSize: 24, marginBottom: 16 }}>Sign Up</h1>

        <button 
          onClick={handleGitHubSignUp}
          disabled={loading}
          className="btn btn-primary"
          style={{ width: "100%", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "var(--color-success)", color: "white" }}
        >
          {loading ? "Signing up..." : "Continue with GitHub"}
        </button>

        <div style={{ display: "flex", alignItems: "center", margin: "16px 0" }}>
          <div style={{ flex: 1, height: 1, backgroundColor: "var(--color-subtle)" }}></div>
          <span style={{ padding: "0 10px", fontSize: 13, color: "var(--color-ink-secondary)" }}>or use email</span>
          <div style={{ flex: 1, height: 1, backgroundColor: "var(--color-subtle)" }}></div>
        </div>

        <form onSubmit={handleSignUp} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label>Name</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label>Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn" style={{ marginTop: 8 }} disabled={loading}>
            {loading ? "Signing up..." : "Sign Up with Email"}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 16, fontSize: 13, textAlign: "center" }}>
          Already have an account? <a href="/sign-in" onClick={(e) => {
            const returnTo = getReturnTo();
            if (returnTo) {
              e.preventDefault();
              router.push(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
            }
          }} style={{ textDecoration: "underline" }}>Sign in</a>
        </p>
      </div>
    </main>
  );
}
