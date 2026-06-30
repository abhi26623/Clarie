import { db, repositories, pullRequests, featureRequests } from "@claire/db";
import { eq, and } from "drizzle-orm";

/**
 * Upserts a pull request row from a validated GitHub webhook payload.
 *
 * - Webhook path (no orgId): resolves owning org from githubId + installationId only.
 * - Replay path (orgId provided): resolves org, then enforces it matches ctx.orgId.
 *   Returns null if org mismatch — caller throws FORBIDDEN.
 */
export async function upsertPullRequestFromWebhook(
  payload: any,
  enforcedOrgId?: string,
): Promise<{
  pullRequestId: number;
  repositoryId: number;
  organizationId: string;
  githubPrNumber: number;
  installationId: number;
} | null> {
  const { pull_request: pr, repository: repoPayload, installation } = payload;
  const installationId = installation?.id as number;
  const githubId = repoPayload?.id as number;

  if (!githubId || !installationId || !pr) return null;

  // Find connected repo by githubId + installationId (both required)
  const [repo] = await db
    .select()
    .from(repositories)
    .where(and(eq(repositories.githubId, githubId), eq(repositories.installationId, installationId)));

  if (!repo) return null;

  // Replay path: enforce org ownership — return null → caller throws FORBIDDEN
  if (enforcedOrgId && repo.organizationId !== enforcedOrgId) return null;

  // Parse claire-request-<id> from PR body
  let featureRequestId: number | null = null;
  if (pr?.body) {
    const match = pr.body.match(/claire-request-(\d+)/);
    if (match?.[1]) {
      const id = parseInt(match[1], 10);
      const [feat] = await db
        .select()
        .from(featureRequests)
        .where(and(eq(featureRequests.id, id), eq(featureRequests.organizationId, repo.organizationId)));
      if (feat) featureRequestId = feat.id;
    }
  }

  const prState: "open" | "closed" | "merged" =
    pr.state === "open" ? "open" : pr.merged ? "merged" : "closed";

  // Upsert pull request row
  const [existing] = await db
    .select()
    .from(pullRequests)
    .where(and(eq(pullRequests.repositoryId, repo.id), eq(pullRequests.githubPrNumber, pr.number)));

  let pullRequestId: number;
  if (existing) {
    const [updated] = await db
      .update(pullRequests)
      .set({
        title: pr.title,
        body: pr.body ?? "",
        state: prState,
        lastCommitSha: pr.head?.sha,
        ...(featureRequestId ? { featureRequestId } : {}),
      })
      .where(eq(pullRequests.id, existing.id))
      .returning();
    pullRequestId = updated.id;
  } else {
    const [created] = await db
      .insert(pullRequests)
      .values({
        repositoryId: repo.id,
        githubPrNumber: pr.number,
        title: pr.title,
        body: pr.body ?? "",
        state: prState,
        authorLogin: pr.user?.login ?? "unknown",
        sourceBranch: pr.head?.ref,
        targetBranch: pr.base?.ref,
        githubUrl: pr.html_url,
        lastCommitSha: pr.head?.sha,
        featureRequestId,
      })
      .returning();
    pullRequestId = created.id;
  }

  return {
    pullRequestId,
    repositoryId: repo.id,
    organizationId: repo.organizationId,
    githubPrNumber: pr.number,
    installationId,
  };
}
