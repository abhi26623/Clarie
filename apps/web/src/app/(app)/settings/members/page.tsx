"use client";
export const dynamic = "force-dynamic";

import * as React from "react";
import { trpc } from "@/lib/trpc";
import { SkeletonCard, EmptyState } from "@claire/ui";
import { Users, Copy, Check, Link2 } from "lucide-react";
import { toast } from "sonner";

export default function MembersPage() {
  const utils = trpc.useUtils();

  const { data: membership } = trpc.organization.getMyMembership.useQuery();
  const { data: members, isLoading } = trpc.organization.getMembers.useQuery();
  const isAdmin = membership?.role === "owner" || membership?.role === "admin";

  // Invite link state — generated once per session; re-clicking reuses the displayed link.
  const [inviteToken, setInviteToken] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const createLink = trpc.organization.createInviteLink.useMutation({
    onSuccess: ({ token }) => {
      setInviteToken(token);
    },
    onError: (err) => toast.error(err.message),
  });

  const inviteUrl =
    inviteToken && typeof window !== "undefined"
      ? `${window.location.origin}/join/${inviteToken}`
      : null;

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("Invite link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy — please copy the link manually.");
    }
  };

  const handleInvite = () => {
    // If we already have a generated link, just copy it again rather than inserting another row.
    if (inviteToken) {
      handleCopy();
      return;
    }
    createLink.mutate();
  };

  function getRoleBadgeClass(role: string) {
    if (role === "owner") return "badge badge--active";
    if (role === "admin") return "badge badge--warning";
    return "badge badge--neutral";
  }

  function getInitials(name: string) {
    return name
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase() ?? "")
      .join("");
  }

  return (
    <div className="container py-8 space-y-12" style={{ maxWidth: 840 }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-subtle pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-ink mb-1">
            Team members
          </h1>
          <p className="text-sm text-ink-secondary">
            View everyone in your workspace and invite new members via a shareable link.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={handleInvite}
            disabled={createLink.isPending}
            className="btn btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium shadow-sm hover:opacity-95 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)", color: "var(--ink-inverse)" }}
            type="button"
          >
            <Users size={18} />
            {createLink.isPending
              ? "Generating…"
              : inviteToken
              ? "Copy link"
              : "Invite team"}
          </button>
        )}
      </div>

      {/* Invite link banner — shown after generation */}
      {inviteUrl && (
        <div
          className="rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3"
          style={{ border: "1px solid var(--border)", background: "var(--surface-raised)" }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Link2 size={15} className="text-ink-tertiary shrink-0" />
            <p
              className="text-sm font-mono text-ink truncate select-all"
              title={inviteUrl}
            >
              {inviteUrl}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopy}
              className="btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-subtle text-ink hover:bg-surface transition-colors"
            >
              {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={() => {
                setInviteToken(null);
                createLink.mutate();
              }}
              className="text-xs text-ink-tertiary hover:text-ink transition-colors underline underline-offset-2"
            >
              New link
            </button>
          </div>
          <p className="text-xs text-ink-tertiary sm:hidden">
            Valid for 7 days. Anyone with this link can join your workspace.
          </p>
        </div>
      )}

      {/* Note shown to non-admins */}
      {!isAdmin && !isLoading && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink-secondary)" }}
        >
          Only admins and owners can generate invite links.
        </div>
      )}

      {/* Members list */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-ink">
          Members{members && members.length > 0 ? ` (${members.length})` : ""}
        </h2>

        {isLoading ? (
          <SkeletonCard />
        ) : !members || members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No members found."
            actionLabel={isAdmin ? "Invite team" : "Contact your admin to add members"}
            onAction={isAdmin ? handleInvite : undefined}
            className="border border-subtle rounded-lg p-8 bg-surface text-center"
          />
        ) : (
          <div className="card divide-y divide-subtle border border-subtle rounded-lg overflow-hidden bg-surface">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-4 p-4 hover:bg-surface-raised transition-colors"
              >
                {/* Avatar initial */}
                <div
                  className="shrink-0 flex items-center justify-center rounded-full text-sm font-semibold"
                  style={{
                    width: 36,
                    height: 36,
                    background: "var(--surface-raised)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--ink-secondary)",
                  }}
                >
                  {getInitials(m.user.name || m.user.email || "?")}
                </div>

                {/* Name + email */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">
                    {m.user.name || "—"}
                  </p>
                  <p className="text-xs text-ink-secondary truncate">{m.user.email}</p>
                </div>

                {/* Role badge + joined date */}
                <div className="flex items-center gap-3 shrink-0">
                  <span className={getRoleBadgeClass(m.role)}>{m.role}</span>
                  {m.createdAt && (
                    <span className="text-xs text-ink-tertiary hidden sm:block">
                      Joined{" "}
                      {new Date(m.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Link validity note */}
      {isAdmin && (
        <p className="text-xs text-ink-tertiary">
          Invite links are valid for 7 days. Anyone with the link can join your workspace as a member.
        </p>
      )}
    </div>
  );
}
