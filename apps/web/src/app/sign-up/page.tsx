"use client";
import { useState } from "react";
import { signUp } from "@claire/auth/client";
import { useRouter } from "next/navigation";

export default function SignUp() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await signUp.email({
      name,
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
        <h1 style={{ fontSize: 24, marginBottom: 16 }}>Sign Up</h1>
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
            {loading ? "Signing up..." : "Sign Up"}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 16, fontSize: 13, textAlign: "center" }}>
          Already have an account? <a href="/sign-in" style={{ textDecoration: "underline" }}>Sign in</a>
        </p>
      </div>
    </main>
  );
}
