"use client";
import { useState } from "react";
import { signIn } from "@shipflow/auth/client";
import { useRouter } from "next/navigation";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await signIn.email({
      email,
      password,
      fetchOptions: {
        onSuccess: () => {
          router.push("/dashboard");
        },
        onError: (ctx) => {
          alert(ctx.error.message);
          setLoading(false);
        },
      }
    });
  };

  return (
    <main className="container" style={{ maxWidth: 400, marginTop: 80 }}>
      <div className="card">
        <h1 style={{ fontSize: 24, marginBottom: 16 }}>Sign In</h1>
        <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label>Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn" style={{ marginTop: 8 }} disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 16, fontSize: 13, textAlign: "center" }}>
          Don't have an account? <a href="/sign-up" style={{ textDecoration: "underline" }}>Sign up</a>
        </p>
      </div>
    </main>
  );
}
