"use client";
export const dynamic = "force-dynamic";
import { useState } from "react";
import { signUp, signIn } from "@claire/auth/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// Matches the GithubIcon in sign-in/page.tsx — inline SVG, no extra dep
const GithubIcon = ({ size = 24 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

export default function SignUp() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
      },
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
      },
    });
  };

  return (
    <main className="container" style={{ maxWidth: 440, marginTop: "var(--space-20)", marginBottom: "var(--space-20)" }}>
      <div className="card" style={{ padding: "var(--space-8)" }}>
        <div style={{ textAlign: "center", marginBottom: "var(--space-8)" }}>
          <h1 style={{ fontSize: "var(--text-2xl)", marginBottom: "var(--space-2)", letterSpacing: "-0.02em" }}>Create account</h1>
          <p style={{ color: "var(--ink-secondary)", fontSize: "var(--text-sm)", margin: 0 }}>Start using Claire today.</p>
        </div>

        {/* GitHub sign-up — primary CTA, matches sign-in page */}
        <button
          onClick={handleGitHubSignUp}
          disabled={loading}
          className="btn btn-primary"
          style={{ width: "100%", height: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)" }}
        >
          <GithubIcon size={18} />
          {loading ? "Signing up…" : "Continue with GitHub"}
        </button>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", margin: "var(--space-6) 0" }}>
          <div style={{ flex: 1, height: 1, backgroundColor: "var(--border)" }} />
          <span style={{ padding: "0 var(--space-4)", fontSize: "var(--text-xs)", color: "var(--ink-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>
            or use email
          </span>
          <div style={{ flex: 1, height: 1, backgroundColor: "var(--border)" }} />
        </div>

        {/* Email sign-up form — inputs and submit match sign-in */}
        <form onSubmit={handleSignUp} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div>
            <label>Name</label>
            <input
              className="input"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ height: 44 }}
            />
          </div>
          <div>
            <label>Email</label>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ height: 44 }}
            />
          </div>
          <div>
            <label>Password</label>
            <input
              className="input"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ height: 44 }}
            />
          </div>
          <button
            type="submit"
            className="btn btn-secondary"
            style={{ width: "100%", height: 44, marginTop: "var(--space-2)", display: "flex", alignItems: "center", justifyContent: "center" }}
            disabled={loading}
          >
            {loading ? "Signing up…" : "Sign up with Email"}
          </button>
        </form>

        <p style={{ marginTop: "var(--space-6)", fontSize: "var(--text-sm)", color: "var(--ink-secondary)", textAlign: "center", marginBottom: 0 }}>
          Already have an account?{" "}
          <a href="/sign-in" onClick={(e) => {
            const returnTo = getReturnTo();
            if (returnTo) {
              e.preventDefault();
              router.push(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
            }
          }}>
            Sign in
          </a>
        </p>
      </div>
    </main>
  );
}
