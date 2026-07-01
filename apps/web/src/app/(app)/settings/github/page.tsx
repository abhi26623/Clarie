"use client";

import * as React from "react";
import { trpc } from "@/lib/trpc";
import { useSearchParams, useRouter } from "next/navigation";
import { StatusBadge, EmptyState, SkeletonCard, parseDbTimestamp } from "@claire/ui";
import { Code2, RefreshCw, Unlink, RotateCcw, Play, Clock } from "lucide-react";
import { toast } from "sonner";

export default function GithubSettingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const utils = trpc.useUtils();

  // Handle one-time install callback — verify state and persist installationId, then clean URL
  const installationIdParam = searchParams.get("installation_id");
  const stateParam = searchParams.get("state");

  const { error: installError } = trpc.github.completeInstallation.useQuery(
    { installationId: parseInt(installationIdParam!, 10), state: stateParam! },
    {
      enabled: !!installationIdParam && !!stateParam,
      refetchOnWindowFocus: false,
      retry: false,
    }
  );

  // On error (expired/tampered state), show toast and clean URL
  React.useEffect(() => {
    if (installError) {
      toast.error("GitHub connection expired. Start again.");
      router.replace("/settings/github");
    }
  }, [installError, router]);

  // On success (installationId now persisted to DB), clean URL and refetch repos
  const prevInstallIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (installationIdParam && !installError && prevInstallIdRef.current !== installationIdParam) {
      prevInstallIdRef.current = installationIdParam;
      utils.github.listRepos.invalidate();
      router.replace("/settings/github");
    }
  }, [installationIdParam, installError, router, utils]);

  // Single query returns { connected, available } using stored org-level installationId
  const { data: repos, isLoading: isLoadingRepos } = trpc.github.listRepos.useQuery();

  const connected = repos?.connected ?? [];
  const available = repos?.available ?? [];

  const getInstallUrlMutation = trpc.github.getInstallUrl.useQuery(undefined, {
    enabled: false,
  });

  const connectMutation = trpc.github.connectRepo.useMutation({
    onSuccess: () => {
      utils.github.listRepos.invalidate();
      utils.organization.getSetupState.invalidate();
      toast.success("Connected");
    },
  });

  const disconnectMutation = trpc.github.disconnectRepo.useMutation({
    onSuccess: () => {
      utils.github.listRepos.invalidate();
      utils.organization.getSetupState.invalidate();
      toast.success("Disconnected");
    },
  });

  const syncMutation = trpc.github.syncPullRequests.useMutation();
  const [syncingId, setSyncingId] = React.useState<number | null>(null);
  const [connectingRepoId, setConnectingRepoId] = React.useState<number | null>(null);

  // Membership + webhook replay — admin only
  const { data: membership } = trpc.organization.getMyMembership.useQuery();
  const isAdmin = membership?.role === "admin";

  const { data: webhookLogs } = trpc.workflow.listWebhookLogs.useQuery(
    undefined,
    { enabled: isAdmin },
  );

  const replayMutation = trpc.workflow.replayWebhook.useMutation({
    onSuccess: () => {
      toast.success("Webhook replayed. AI review started.");
      utils.review.listAll.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const [replayingId, setReplayingId] = React.useState<number | null>(null);

  const handleReplay = async (logId: number) => {
    setReplayingId(logId);
    try {
      await replayMutation.mutateAsync({ webhookLogId: logId });
    } finally {
      setReplayingId(null);
    }
  };

  const handleInstallClick = async () => {
    const res = await getInstallUrlMutation.refetch();
    if (res.data?.url) {
      window.location.href = res.data.url;
    }
  };

  const handleSync = async (repoId: number) => {
    setSyncingId(repoId);
    try {
      await syncMutation.mutateAsync({ repoId });
      toast.success("Synced pull requests");
    } finally {
      setSyncingId(null);
    }
  };

  // CTA label based on connection state
  let ctaLabel = "Install GitHub App";
  if (connected.length > 0) {
    ctaLabel = "Manage GitHub App";
  } else if (available.length > 0) {
    ctaLabel = "Add repositories";
  }

  return (
    <div className="container py-8 space-y-12" style={{ maxWidth: 840 }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-subtle pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-ink mb-1">GitHub</h1>
          <p className="text-sm text-ink-secondary">
            Connect repositories to sync pull requests and trigger automated AI code reviews.
          </p>
        </div>
        <button
          onClick={handleInstallClick}
          disabled={getInstallUrlMutation.isFetching}
          className="btn btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium shadow-sm hover:opacity-95 transition-opacity disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "var(--ink-inverse)" }}
          type="button"
        >
          <Code2 size={18} /> {getInstallUrlMutation.isFetching ? "Redirecting…" : ctaLabel}
        </button>
      </div>

      {/* Available repositories — always visible when installationId is stored */}
      {isLoadingRepos ? (
        <SkeletonCard />
      ) : available.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Available repositories</h2>
          <div className="card divide-y divide-subtle border border-subtle rounded-lg overflow-hidden bg-surface">
            {available.map((repo: any) => {
              const isConnected = connected.some((c) => c.fullName === repo.full_name);
              const isConnecting = connectingRepoId === repo.id;
              return (
                <div
                  key={repo.id}
                  className={`flex items-center justify-between p-4 hover:bg-surface-raised transition-colors ${isConnected ? "opacity-60" : ""}`}
                >
                  <div>
                    <p className="font-medium text-sm text-ink">{repo.name}</p>
                    <p className="text-xs text-ink-secondary">{repo.full_name}</p>
                  </div>
                  <button
                    onClick={() => {
                      setConnectingRepoId(repo.id);
                      connectMutation.mutate(
                        { repoId: repo.id, name: repo.name, fullName: repo.full_name },
                        { onSettled: () => setConnectingRepoId(null) }
                      );
                    }}
                    disabled={isConnected || connectMutation.isPending}
                    className={`btn text-xs px-3 py-1.5 rounded-md font-medium transition-all ${
                      isConnected
                        ? "bg-surface text-ink-secondary cursor-default border border-subtle"
                        : isConnecting
                        ? "bg-surface text-ink-tertiary border border-subtle cursor-wait"
                        : "btn-primary"
                    }`}
                  >
                    {isConnected ? "Connected" : isConnecting ? "Connecting…" : "Connect"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Connected repositories */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-ink">Connected repositories</h2>
        {isLoadingRepos ? (
          <SkeletonCard />
        ) : connected.length > 0 ? (
          <div className="card divide-y divide-subtle border border-subtle rounded-lg overflow-hidden bg-surface">
            {connected.map((repo) => (
              <div key={repo.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 gap-4 hover:bg-surface-raised transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <p className="font-medium text-sm text-ink">{repo.name}</p>
                    <StatusBadge status={repo.webhookActive ? "Webhook active" : "Inactive"} tier={repo.webhookActive ? "active" : "neutral"} />
                  </div>
                  <p className="text-xs text-ink-secondary">{repo.fullName}</p>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => handleSync(repo.id)}
                    disabled={syncingId === repo.id}
                    className="btn border border-subtle text-ink hover:bg-surface px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw size={13} className={syncingId === repo.id ? "animate-spin" : ""} /> Sync
                  </button>
                  <button
                    onClick={() => disconnectMutation.mutate({ repoId: repo.id })}
                    disabled={disconnectMutation.isPending}
                    className="btn border border-subtle text-ink-secondary hover:text-error hover:border-error px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Unlink size={13} /> Disconnect
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Code2}
            title="No GitHub repositories connected yet."
            actionLabel="Install GitHub App"
            onAction={handleInstallClick}
            className="border border-subtle rounded-lg p-8 bg-surface text-center"
          />
        )}
      </div>

      {/* Manual webhook fallback */}
      <div className="card border border-subtle rounded-lg p-6 bg-surface space-y-4">
        <h3 className="text-base font-semibold text-ink">Manual webhook configuration</h3>
        <p className="text-sm text-ink-secondary leading-relaxed">
          If you prefer to configure webhooks manually or need to point to a local development tunnel (such as ngrok), set up a repository webhook pointing to the endpoint below.
        </p>
        <div className="p-3 bg-canvas border border-subtle rounded font-mono text-xs text-ink select-all overflow-x-auto">
          https://&lt;your-domain&gt;/api/webhooks/github
        </div>
        <div className="text-xs text-ink-secondary space-y-1.5">
          <p><strong className="text-ink font-medium">Content type:</strong> application/json</p>
          <p><strong className="text-ink font-medium">Secret:</strong> GITHUB_APP_WEBHOOK_SECRET from your server environment</p>
          <p><strong className="text-ink font-medium">Events:</strong> Pull requests, Issues</p>
        </div>
      </div>

      {/* Webhook replay — admin only */}
      {isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <RotateCcw size={15} className="text-ink-secondary" />
            <h2 className="text-lg font-semibold text-ink">Webhook replay</h2>
          </div>
          <p className="text-sm text-ink-secondary">
            Re-fire a stored webhook event to trigger a fresh AI review without a live tunnel. Admin only.
          </p>
          {!webhookLogs || webhookLogs.length === 0 ? (
            <div
              className="rounded-lg px-4 py-6 text-sm text-center"
              style={{
                border: "1px solid var(--border-subtle)",
                background: "var(--surface)",
                color: "var(--ink-tertiary)",
              }}
            >
              No replayable webhook events yet. Logs appear after a pull request is opened or synced.
            </div>
          ) : (
            <div
              className="rounded-lg overflow-hidden"
              style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
            >
              {(webhookLogs as any[]).map((log: any, idx: number) => {
                const action = log.payload?.action ?? "";
                const repoName = log.payload?.repository?.full_name ?? log.payload?.repository?.name ?? "";
                const prTitle = log.payload?.pull_request?.title ?? "";
                const isReplaying = replayingId === log.id;

                return (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-raised transition-colors"
                    style={{ borderTop: idx === 0 ? "none" : "1px solid var(--border-subtle)" }}
                  >
                    {/* Event info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">
                        {prTitle || `pull_request.${action}`}
                      </p>
                      <p className="text-xs font-mono mt-0.5" style={{ color: "var(--ink-tertiary)" }}>
                        {repoName} · {action} ·{" "}
                        {log.createdAt
                          ? parseDbTimestamp(log.createdAt)?.toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </p>
                    </div>

                    {/* Replay button */}
                    <button
                      onClick={() => handleReplay(log.id)}
                      disabled={isReplaying || replayMutation.isPending}
                      className="btn border border-subtle text-ink hover:bg-surface px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <Play size={11} className={isReplaying ? "animate-pulse" : ""} />
                      {isReplaying ? "Replaying…" : "Replay webhook"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
