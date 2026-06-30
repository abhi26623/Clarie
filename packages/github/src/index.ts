import { App } from "@octokit/app";
import { Octokit } from "octokit";
import { env } from "@claire/config/env";

// Normalize private key to handle escaped newlines in environment variables
const privateKey = env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n");

export const githubApp = new App({
  appId: env.GITHUB_APP_ID,
  privateKey: privateKey,
  webhooks: {
    secret: env.GITHUB_APP_WEBHOOK_SECRET,
  },
  Octokit: Octokit,
});

/**
 * Returns an installation-authenticated Octokit instance.
 */
export async function getInstallationOctokit(installationId: number): Promise<Octokit> {
  return githubApp.getInstallationOctokit(installationId) as Promise<Octokit>;
}

/**
 * Lists repositories accessible to the installation.
 */
export async function listRepos(installationId: number) {
  const octokit = await getInstallationOctokit(installationId);
  const { data } = await octokit.rest.apps.listReposAccessibleToInstallation({
    per_page: 100,
  });
  return data.repositories;
}

/**
 * Fetches pull request details using a specific installation ID.
 */
export async function getPullRequest(params: {
  owner: string;
  repo: string;
  prNumber: number;
  installationId: number;
}) {
  const octokit = await getInstallationOctokit(params.installationId);
  const { data } = await octokit.rest.pulls.get({
    owner: params.owner,
    repo: params.repo,
    pull_number: params.prNumber,
  });
  return data;
}

/**
 * Fetches pull request files, addition/deletion counts, and patches.
 */
export async function getPullRequestFiles(params: {
  owner: string;
  repo: string;
  prNumber: number;
  installationId: number;
}) {
  const octokit = await getInstallationOctokit(params.installationId);
  const { data } = await octokit.rest.pulls.listFiles({
    owner: params.owner,
    repo: params.repo,
    pull_number: params.prNumber,
    per_page: 100,
  });
  return data.map((file: any) => ({
    filename: file.filename,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    patch: file.patch ?? null,
  }));
}

/**
 * Posts a normal PR issue comment. This is the primary demo-safe path.
 */
export async function postPullRequestComment(params: {
  owner: string;
  repo: string;
  prNumber: number;
  installationId: number;
  body: string;
}) {
  const octokit = await getInstallationOctokit(params.installationId);
  const { data } = await octokit.rest.issues.createComment({
    owner: params.owner,
    repo: params.repo,
    issue_number: params.prNumber,
    body: params.body,
  });
  return data;
}

/**
 * Posts an inline PR review with optional line-level comments.
 * Throws on failure — caller is responsible for fallback.
 */
export async function postPullRequestReview(params: {
  owner: string;
  repo: string;
  prNumber: number;
  installationId: number;
  body: string;
  comments?: Array<{ path: string; position?: number; line?: number; body: string }>;
}) {
  const octokit = await getInstallationOctokit(params.installationId);
  const { data } = await octokit.rest.pulls.createReview({
    owner: params.owner,
    repo: params.repo,
    pull_number: params.prNumber,
    body: params.body,
    comments: params.comments && params.comments.length > 0 ? params.comments : undefined,
    event: "COMMENT",
  });
  return data;
}
