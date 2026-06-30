"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { authClient } from "@claire/auth/client";

export default function OnboardingClient() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  
  const createOrg = trpc.organization.create.useMutation({
    onSuccess: async (res) => {
      toast.success("Workspace created successfully.");
      if (res?.id) {
        await authClient.organization.setActive({ organizationId: res.id });
      }
      await authClient.getSession({ query: { disableCookieCache: true } });
      router.push("/dashboard");
      router.refresh();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create workspace.");
    },
  });

  // Basic slug generation (lowercase, replace spaces with hyphens, remove non-alphanumeric)
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();

  const RESERVED_SLUGS = new Set([
    "demo", "shipflow-demo", "api", "dashboard", "sign-in", "sign-up", "join", 
    "p", "onboarding", "settings", "auth", "webhooks", "app"
  ]);

  const handleCreate = () => {
    setErrorMsg("");
    if (RESERVED_SLUGS.has(slug)) {
      setErrorMsg("This workspace name results in a reserved URL. Please choose another.");
      return;
    }
    createOrg.mutate({ name, slug });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-canvas text-ink">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Create your workspace</h1>
          <p className="text-ink-secondary">Set up your portal and invite your team later.</p>
        </div>
        
        <div className="card space-y-6 bg-surface p-6 rounded-lg border border-subtle">
          <div className="space-y-2">
            <label className="text-sm font-medium">Workspace Name</label>
            <input
              className="input w-full px-3 py-2"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrorMsg("");
              }}
              placeholder="e.g. Acme Corp"
              autoFocus
            />
            {name && !errorMsg && (
              <p className="text-xs text-ink-tertiary">
                Portal URL: <span className="text-ink-secondary font-mono">/p/{slug}</span>
              </p>
            )}
            {errorMsg && (
              <p className="text-xs text-error">{errorMsg}</p>
            )}
          </div>
          
          <button
            className="btn w-full py-2 bg-ink text-canvas hover:bg-ink-secondary rounded-md font-medium disabled:opacity-50 transition-colors"
            disabled={createOrg.isPending || name.length < 2 || !slug}
            onClick={handleCreate}
          >
            {createOrg.isPending ? "Creating..." : "Create workspace"}
          </button>
        </div>
        <p className="text-center text-sm text-ink-secondary mt-4">
          Everything else can be set up later.
        </p>
      </div>
    </main>
  );
}
