"use client";

import * as React from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { authClient } from "@claire/auth/client";
import { SkeletonCard } from "@claire/ui";
import { Code2, Users, CreditCard, CheckCircle2, ChevronRight } from "lucide-react";

const NAV_CARDS = [
  {
    href: "/settings/github",
    icon: Code2,
    title: "GitHub",
    description: "Connect repositories, sync pull requests, and configure automated AI code reviews.",
  },
  {
    href: "/settings/members",
    icon: Users,
    title: "Team members",
    description: "Manage workspace members, invite new team members, and adjust roles.",
  },
  {
    href: "/billing",
    icon: CreditCard,
    title: "Billing",
    description: "View your current plan, AI credit usage, and upgrade your workspace to PRO.",
  },
];

export default function SettingsPage() {
  const { data: orgs, isLoading: isLoadingOrgs } = trpc.organization.list.useQuery();
  const { data: session, isPending: isLoadingSession } = authClient.useSession();
  const { data: setupState, isLoading: isLoadingSetup } = trpc.organization.getSetupState.useQuery();

  const isLoading = isLoadingOrgs || isLoadingSession || isLoadingSetup;

  const activeOrgId = session?.session?.activeOrganizationId;
  const activeOrg = orgs?.find((o) => o.id === activeOrgId) ?? orgs?.[0];

  // Render the plan label from the stored value — normalise to uppercase for display.
  // This avoids any hardcoded "FREE"/"PRO" comparison; if the DB ever uses a different
  // casing or a new tier, it renders correctly without a code change.
  const planLabel = setupState?.plan ? setupState.plan.toUpperCase() : null;
  const isPro = planLabel === "PRO";

  if (isLoading) {
    return (
      <div className="container py-8" style={{ maxWidth: 840 }}>
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-12" style={{ maxWidth: 840 }}>
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="border-b border-subtle pb-6">
        <h1 className="text-2xl sm:text-3xl font-display font-semibold text-ink mb-1">Settings</h1>
        <p className="text-sm text-ink-secondary">
          Manage your workspace preferences, integrations, and subscription.
        </p>
      </div>

      {/* ─── Workspace overview card ─────────────────────────────── */}
      <div className="card border border-subtle rounded-lg overflow-hidden bg-surface">
        <div className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-ink-secondary mb-1">
              Active workspace
            </p>
            {activeOrg ? (
              <h2 className="text-xl font-semibold text-ink">{activeOrg.name}</h2>
            ) : (
              <p className="text-sm text-ink-tertiary italic">No active workspace</p>
            )}
          </div>

          {planLabel && (
            <span
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-mono text-xs self-start sm:self-auto"
              style={
                isPro
                  ? {
                      background: "var(--status-success-bg)",
                      color: "var(--status-success-fg)",
                      border: "1px solid var(--status-success-border)",
                    }
                  : {
                      background: "var(--status-neutral-bg, var(--surface-raised))",
                      color: "var(--status-neutral-fg, var(--ink-secondary))",
                      border: "1px solid var(--border-subtle)",
                    }
              }
            >
              {isPro && <CheckCircle2 size={13} />}
              {planLabel} Plan
            </span>
          )}
        </div>
      </div>

      {/* ─── Navigation cards ────────────────────────────────────── */}
      <div>
        <h3 className="text-xs font-mono uppercase tracking-wider text-ink-secondary mb-4">
          Workspace settings
        </h3>

        <div className="flex flex-col gap-3">
          {NAV_CARDS.map(({ href, icon: Icon, title, description }) => (
            <Link
              key={href}
              href={href}
              className="card group border border-subtle rounded-lg bg-surface hover:bg-surface-raised transition-colors p-5 flex items-center gap-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            >
              <div
                className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: "var(--surface-raised)" }}
              >
                <Icon size={20} className="text-ink-secondary group-hover:text-ink transition-colors" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink mb-0.5">{title}</p>
                <p className="text-xs text-ink-secondary leading-relaxed">{description}</p>
              </div>

              <ChevronRight
                size={16}
                className="flex-shrink-0 text-ink-tertiary group-hover:text-ink-secondary transition-colors"
              />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
