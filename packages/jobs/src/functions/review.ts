import { inngest } from "../client";
import { db, pullRequests, featureRequests, aiReviews, reviewIssues, prds, tasks, repositories, AI_CREDIT_COSTS, consumeAiCredits, CreditsExhaustedError, CREDITS_EXHAUSTED_SENTINEL } from "@claire/db";
import { eq, and, desc } from "drizzle-orm";
import {
  getPullRequestFiles,
  postPullRequestReview,
  postPullRequestComment,
} from "@claire/github";
import { generateObjectResilient } from "@claire/ai";
import { writeStep } from "../run-workflow";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Output schema — filePath and lineNumber are nullable for PR-wide issues
// ---------------------------------------------------------------------------
const ReviewOutputSchema = z.object({
  passed: z.boolean(),
  confidence: z.number().int().min(0).max(100),
  summary: z.string(),
  issues: z.array(
    z.object({
      type: z.enum([
        "REQUIREMENT_MISMATCH",
        "MISSING_ACCEPTANCE",
        "EDGE_CASE_MISSED",
        "SECURITY",
        "PERFORMANCE",
        "CODE_QUALITY",
        "MISSING_TESTS",
      ]),
      severity: z.enum(["BLOCKING", "NON_BLOCKING", "SUGGESTION"]),
      title: z.string(),
      description: z.string(),       // WHY the issue exists, plain English
      suggestion: z.string(),        // specific fix, not generic
      filePath: z.string().nullable(),   // null for PR-wide issues
      lineNumber: z.number().nullable(), // null if not pinnable to a single line
    })
  ),
  criteriaVerdicts: z.array(
    z.object({
      criterionId: z.string(),
      verdict: z.enum(["met", "partial", "not_met"]),
      evidence: z.string(),
    })
  ).optional(),
});

// ---------------------------------------------------------------------------
// Helper: Ensure acceptanceCriteria are structured objects { id, text }
// ---------------------------------------------------------------------------
async function ensureStructuredCriteria(
  prd: { id: number; acceptanceCriteria: unknown } | null | undefined
): Promise<Array<{ id: string; text: string }>> {
  if (!prd || !prd.acceptanceCriteria) return [];
  const raw = prd.acceptanceCriteria as any;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (typeof raw[0] === "object" && raw[0]?.id) return raw;
  const structured = raw.map((text: any, i: number) => ({
    id: `ac-${i}`,
    text: typeof text === "string" ? text : String(text),
  }));
  await db.update(prds)
    .set({ acceptanceCriteria: structured })
    .where(eq(prds.id, prd.id));
  return structured;
}

// ---------------------------------------------------------------------------
// Inngest PR review workflow
// Triggered on: github/pr.opened, github/pr.synchronize
// ---------------------------------------------------------------------------
export const prReviewWorkflow = inngest.createFunction(
  { id: "github-pr-review", concurrency: { limit: 1, key: "event.data.pullRequestId" } },
  [{ event: "github/pr.opened" }, { event: "github/pr.synchronize" }],
  async ({ event, step }) => {
    const { pullRequestId, installationId } = z.object({
      pullRequestId: z.number(),
      installationId: z.number(),
    }).parse(event.data);

    // ------------------------------------------------------------------
    // logStep — writes workflow telemetry to:
    //   1. The pull_request entity (always)
    //   2. The feature_request entity (only when featureRequestId is set)
    // Each write is a separate Inngest step so they retry independently.
    // ------------------------------------------------------------------
    const logStep = async (
      stepName: string,
      status: "running" | "done" | "failed",
      label: string
    ) => {
      await step.run(`write_step_${stepName}_pr`, async () => {
        await writeStep(
          { entityType: "pull_request", entityId: String(pullRequestId) },
          stepName,
          status,
          { label }
        );
      });

      await step.run(`write_step_${stepName}_feat`, async () => {
        // Re-read to get featureRequestId — avoids stale closure value
        const pr = await db.query.pullRequests.findFirst({
          where: eq(pullRequests.id, pullRequestId),
        });
        // Only write if PR is linked to a feature — never write with undefined entityId
        if (pr?.featureRequestId) {
          await writeStep(
            {
              entityType: "feature_request",
              entityId: String(pr.featureRequestId),
            },
            `pr_review_${stepName}`,
            status,
            { label }
          );
        }
      });
    };

    // Track the DB reviewId so the catch block can mark it failed
    let reviewId: number | null = null;

    try {
      await logStep("fetching_context", "running", "Fetching PR and Feature context");

      // ------------------------------------------------------------------
      // Step 1: Load all context — PR, feature, PRD, previous reviews
      // ------------------------------------------------------------------
      const contextData = await step.run("load_context", async () => {
        const pr = await db.query.pullRequests.findFirst({
          where: eq(pullRequests.id, pullRequestId),
          with: { repository: true },
        });
        if (!pr) throw new Error(`PR ${pullRequestId} not found`);

        // Unlinked-PR path: feature/prd/tasks all stay null — handled gracefully later
        let feature = null;
        let prd = null;
        let featTasks: typeof tasks.$inferSelect[] = [];

        if (pr.featureRequestId) {
          feature = await db.query.featureRequests.findFirst({
            where: eq(featureRequests.id, pr.featureRequestId),
          });
          prd = await db.query.prds.findFirst({
            where: eq(prds.featureRequestId, pr.featureRequestId),
          });
          featTasks = await db.query.tasks.findMany({
            where: eq(tasks.featureRequestId, pr.featureRequestId),
          });
        }

        const previousReviews = await db.query.aiReviews.findMany({
          where: eq(aiReviews.pullRequestId, pullRequestId),
          orderBy: [desc(aiReviews.reviewNumber)],
          with: { issues: true },
        });

        return { pr, feature, prd, featTasks, previousReviews };
      });

      const { pr, feature, prd, previousReviews } = contextData;
      const reviewNumber = (previousReviews[0]?.reviewNumber ?? 0) + 1;

      await logStep("fetching_context", "done", "Fetched context");
      await logStep("fetching_diff", "running", "Fetching PR diff files");

      // ------------------------------------------------------------------
      // Step 2: Fetch and budget diff files
      // ------------------------------------------------------------------
      const diffData = await step.run("fetch_diffs", async () => {
        const [owner, repoName] = pr.repository.fullName.split("/");
        let files = await getPullRequestFiles({
          owner,
          repo: repoName,
          prNumber: pr.githubPrNumber,
          installationId,
        });

        // Strip noise: files without patches, lockfiles, generated/minified artefacts
        files = files.filter((f) => {
          if (!f.patch) return false;
          const n = f.filename.toLowerCase();
          if (n.endsWith("package-lock.json")) return false;
          if (n.endsWith("pnpm-lock.yaml")) return false;
          if (n.endsWith("yarn.lock")) return false;
          if (n.includes("/dist/")) return false;
          if (n.includes("/build/")) return false;
          if (n.endsWith(".min.js")) return false;
          if (n.endsWith(".min.css")) return false;
          return true;
        });

        // Sort by patch length descending — most changed code first
        files.sort((a, b) => (b.patch?.length ?? 0) - (a.patch?.length ?? 0));

        // Budget: 40 files max AND ~80 000 tokens max (1 token ≈ 4 chars)
        let approxTokens = 0;
        const keptFiles: typeof files = [];
        let truncated = false;

        for (const f of files) {
          const patchTokens = (f.patch?.length ?? 0) / 4;
          if (approxTokens + patchTokens > 80_000 || keptFiles.length >= 40) {
            truncated = true;
            continue;
          }
          keptFiles.push(f);
          approxTokens += patchTokens;
        }

        return { keptFiles, totalFilesCount: files.length, truncated };
      });

      await logStep("fetching_diff", "done", "Fetched diff files");

      // ------------------------------------------------------------------
      // Step 3: Create review row in DB as "running"
      // ------------------------------------------------------------------
      reviewId = await step.run("create_review_row", async () => {
        const [inserted] = await db
          .insert(aiReviews)
          .values({
            pullRequestId,
            featureRequestId: pr.featureRequestId ?? null,
            status: "running",
            reviewNumber,
          })
          .onConflictDoUpdate({
            target: [aiReviews.pullRequestId, aiReviews.reviewNumber],
            set: {
              status: "running",
              featureRequestId: pr.featureRequestId ?? null,
            },
          })
          .returning();
        return inserted.id;
      });

      await logStep("analyzing_code", "running", `Analyzing code (Review #${reviewNumber})`);

      // ------------------------------------------------------------------
      // Step 4: AI generation
      // TODO G1: add credit gate — check aiCreditsUsed < aiCreditsLimit before this step
      // ------------------------------------------------------------------
      const reviewResult = await step.run("run_ai", async () => {
        let systemPrompt = `You are a Senior QA and Engineering Reviewer.\n`;
        const canonicalCriteria = await ensureStructuredCriteria(prd);

        if (feature && prd) {
          systemPrompt += `Judge: Does the code satisfy the PRD problem + goals? All acceptance criteria met? Edge cases handled? Security concerns? Performance? Production-ready?\n`;
          systemPrompt += `For EACH acceptance criterion (by id), decide met / partial / not_met based ONLY on evidence in the diff. Provide ONE short sentence naming the specific file. If the diff does not implement a criterion, mark not_met. Evaluate EVERY criterion — never skip or summarize. Return the EXACT id provided. Do NOT modify, normalize, rename, or invent ids.\n`;
        } else {
          // Unlinked PR — code-quality / security only, no PRD checks
          systemPrompt += `No feature request is linked to this PR. Review only for code quality, security, performance, and obvious production risks.\n`;
        }

        systemPrompt += `IGNORE: style, naming, formatting, linting.\n`;
        systemPrompt += `For each issue: explain WHY it matters in plain English. Give a SPECIFIC fix, not a generic suggestion.\n`;
        systemPrompt += `If an issue is PR-wide (no single file/line), set filePath and lineNumber to null.\n`;

        let promptContent = `PR Title: ${pr.title}\n`;

        if (feature) {
          promptContent += `Feature: ${feature.title}\n`;
          if (prd) {
            promptContent += `PRD Problem: ${prd.problemStatement}\n`;
            promptContent += `PRD Goals: ${JSON.stringify(prd.goals)}\n`;
            promptContent += `Acceptance Criteria (evaluate each):\n`;
            for (const ac of canonicalCriteria) {
              promptContent += `  ${ac.id}: ${ac.text}\n`;
            }
          }
        }

        promptContent += `\nChanged files:\n`;
        for (const f of diffData.keptFiles) {
          promptContent += `File: ${f.filename}\nPatch:\n${f.patch}\n---\n`;
        }

        const rawResult = await generateObjectResilient({
          schema: ReviewOutputSchema,
          system: systemPrompt,
          prompt: promptContent,
          modelPurpose: "premiumReview",
          maxAttempts: 1,
          timeoutMs: 48_000,
        });

        const rawVerdicts = rawResult.criteriaVerdicts ?? [];
        const FILE_REF_RE = /[\w./-]+\.(ts|tsx|js|jsx|css|scss|sql|json|md|py|go|rb|java|prisma)\b/;
        const guardedVerdicts = rawVerdicts.map((v) => {
          if (v.verdict === "met" && !FILE_REF_RE.test(v.evidence)) {
            return { ...v, verdict: "partial" as const };
          }
          return v;
        });

        const reconciledVerdicts = canonicalCriteria.map((ac) => {
          let found = guardedVerdicts.find((v) => v.criterionId === ac.id);
          if (!found) {
            const normAc = ac.id.toLowerCase().replace(/[^a-z0-9]/g, "");
            found = guardedVerdicts.find((v) => v.criterionId.toLowerCase().replace(/[^a-z0-9]/g, "") === normAc);
            if (found) {
              console.warn(`[PR Review] Normalized match drift for AC ID: expected "${ac.id}", AI returned "${found.criterionId}"`);
            } else {
              console.warn(`[PR Review] Unmatched AC ID from AI review. Defaulting to not_met for canonical ID: "${ac.id}"`);
            }
          }
          return found
            ? { criterionId: ac.id, text: ac.text, verdict: found.verdict, evidence: found.evidence }
            : {
                criterionId: ac.id,
                text: ac.text,
                verdict: "not_met" as const,
                evidence: "Not implemented in this diff.",
              };
        });

        return {
          ...rawResult,
          criteriaVerdicts: reconciledVerdicts,
        };
      });

      await logStep("analyzing_code", "done", "Analyzed code");

      // ------------------------------------------------------------------
      // Step 4b: Consume AI credits AFTER successful review generation.
      // Uses a unique step.run name so Inngest memoises this separately from
      // any other consume step. reviewNumber > 1 = re-review (same cost today,
      // named separately for future cost divergence).
      // ------------------------------------------------------------------
      await step.run("consume-review-credits", async () => {
        const orgId = contextData.feature?.organizationId
          ?? (await db.query.repositories.findFirst({
              where: eq(repositories.id, contextData.pr.repositoryId),
            }))?.organizationId;
        if (!orgId) return; // unlinked PR with no org context — skip gracefully

        const cost = reviewNumber > 1 ? AI_CREDIT_COSTS.reReview : AI_CREDIT_COSTS.review;
        try {
          await consumeAiCredits(orgId, cost);
        } catch (err) {
          if (err instanceof CreditsExhaustedError) {
            // Credits ran out mid-review: the review is already saved. Surface the
            // sentinel on the feature so the UI shows an upgrade CTA.
            if (contextData.pr.featureRequestId) {
              await db.update(featureRequests)
                .set({ aiReasoning: `${CREDITS_EXHAUSTED_SENTINEL}${err.message}` })
                .where(eq(featureRequests.id, contextData.pr.featureRequestId));
            }
            return; // don't rethrow — review was saved successfully, just credits exhausted
          }
          throw err;
        }
      });

      await logStep("saving_results", "running", "Saving review results");

      // ------------------------------------------------------------------
      // Step 5: Persist results + diff resolved issues from previous review
      // ------------------------------------------------------------------
      const resolvedIssuesList = await step.run("save_and_diff", async () => {
        // Mark review completed
        await db
          .update(aiReviews)
          .set({
            status: "completed",
            passed: reviewResult.passed,
            confidence: reviewResult.confidence,
            summary: reviewResult.summary,
            criteriaVerdicts: reviewResult.criteriaVerdicts ?? null,
            completedAt: new Date().toISOString(),
            model: "gemini/openrouter",
          })
          .where(eq(aiReviews.id, reviewId!));

        // Insert new issues
        if (reviewResult.issues.length > 0) {
          await db.insert(reviewIssues).values(
            reviewResult.issues.map((i) => ({
              reviewId: reviewId!,
              type: i.type,
              severity: i.severity,
              title: i.title,
              description: i.description,
              suggestion: i.suggestion,
              filePath: i.filePath,
              lineNumber: i.lineNumber,
              resolved: false,
            }))
          );
        }

        // Resolved-issue diffing — only on re-reviews (reviewNumber > 1)
        // Fingerprint excludes lineNumber because lines shift after fixes.
        const resolvedIssues: (typeof reviewIssues.$inferSelect)[] = [];

        if (reviewNumber > 1 && previousReviews.length > 0) {
          const prevReview = previousReviews[0];
          if (prevReview?.issues) {
            const newFingerprints = new Set(
              reviewResult.issues.map(
                (i) =>
                  `${i.type}:${i.title}:${i.filePath ?? "null"}:${i.description.slice(0, 120)}`
              )
            );

            for (const prevIssue of prevReview.issues) {
              if (prevIssue.resolved) continue; // already marked resolved
              const fp = `${prevIssue.type}:${prevIssue.title}:${prevIssue.filePath ?? "null"}:${prevIssue.description.slice(0, 120)}`;
              if (!newFingerprints.has(fp)) {
                await db
                  .update(reviewIssues)
                  .set({ resolved: true })
                  .where(eq(reviewIssues.id, prevIssue.id));
                resolvedIssues.push(prevIssue);
              }
            }
          }
        }

        return resolvedIssues;
      });

      await logStep("saving_results", "done", "Saved results");
      await logStep("updating_feature", "running", "Updating feature status");

      // ------------------------------------------------------------------
      // Step 6: Conditionally update feature status
      // Re-reads live status from DB — never uses the stale closure value
      // that was loaded in step 1 (the feature may have moved since then).
      // ------------------------------------------------------------------
      await step.run("update_feature", async () => {
        if (!pr.featureRequestId) return; // Unlinked PR — skip entirely

        // Re-read LIVE status to guard against stale closure
        const liveFeature = await db.query.featureRequests.findFirst({
          where: eq(featureRequests.id, pr.featureRequestId),
        });
        if (!liveFeature) return;

        const allowedTransitions = ["in_development", "in_review", "fix_needed"];
        if (!allowedTransitions.includes(liveFeature.status)) return; // already shipped/approved — do not touch

        const hasBlocking = reviewResult.issues.some((i) => i.severity === "BLOCKING");
        const newStatus = hasBlocking ? "fix_needed" : "ready_for_approval";

        await db
          .update(featureRequests)
          .set({ status: newStatus as any })
          .where(eq(featureRequests.id, liveFeature.id));
      });

      await logStep("updating_feature", "done", "Updated feature status");
      await logStep("posting_github", "running", "Posting review to GitHub");

      // ------------------------------------------------------------------
      // Step 7: Build Markdown body and post to GitHub
      // Strategy: try inline review first → on ANY error fall back to a
      // plain PR comment to guarantee the review body always lands.
      // ------------------------------------------------------------------
      await step.run("post_review", async () => {
        let mdBody = `## 🤖 Claire AI Review — #${reviewNumber}\n`;
        mdBody += `**Result**: ${reviewResult.passed ? "✅ Passed" : "❌ Needs Changes"} | **Confidence**: ${reviewResult.confidence}%\n\n`;
        mdBody += `${reviewResult.summary}\n\n`;

        if (resolvedIssuesList.length > 0) {
          mdBody += `### ✅ Resolved from Previous Review (${resolvedIssuesList.length})\n`;
          for (const i of resolvedIssuesList) {
            mdBody += `- ~~${i.title}~~ (${i.filePath ?? "PR-wide"})\n`;
          }
          mdBody += "\n";
        }

        const canonicalCriteria = await ensureStructuredCriteria(prd);
        const verdicts = reviewResult.criteriaVerdicts ?? [];
        if (canonicalCriteria.length > 0 && verdicts.length > 0) {
          const metCount = verdicts.filter((v) => v.verdict === "met").length;
          mdBody += `### 📋 Requirement Coverage (${metCount}/${canonicalCriteria.length})\n`;
          for (const ac of canonicalCriteria) {
            const v = verdicts.find((x) => x.criterionId === ac.id) ?? {
              verdict: "not_met",
              evidence: "Not implemented in this diff.",
            };
            if (v.verdict === "met") {
              mdBody += `- [x] ${ac.id}: ${ac.text} — \`${v.evidence}\`\n`;
            } else if (v.verdict === "partial") {
              mdBody += `- [ ] ⚠️ ${ac.id}: ${ac.text} (partial) — \`${v.evidence}\`\n`;
            } else {
              mdBody += `- [ ] ${ac.id}: ${ac.text} — \`${v.evidence}\`\n`;
            }
          }
          mdBody += "\n";
        }

        const blocking = reviewResult.issues.filter((i) => i.severity === "BLOCKING");
        if (blocking.length > 0) {
          mdBody += `### 🔴 Blocking Issues (${blocking.length})\n`;
          for (const i of blocking) {
            mdBody += `#### ${i.title}\n`;
            mdBody += `**File**: \`${i.filePath ? `${i.filePath}:${i.lineNumber ?? "any"}` : "PR-wide"}\` | **Why**: ${i.description}\n`;
            mdBody += `**Fix**: ${i.suggestion}\n\n`;
          }
        }

        const nonBlocking = reviewResult.issues.filter((i) => i.severity === "NON_BLOCKING");
        if (nonBlocking.length > 0) {
          mdBody += `### 🟡 Non-blocking (${nonBlocking.length})\n`;
          for (const i of nonBlocking) {
            mdBody += `#### ${i.title}\n`;
            mdBody += `**File**: \`${i.filePath ? `${i.filePath}:${i.lineNumber ?? "any"}` : "PR-wide"}\` | **Why**: ${i.description}\n`;
            mdBody += `**Fix**: ${i.suggestion}\n\n`;
          }
        }

        const suggestions = reviewResult.issues.filter((i) => i.severity === "SUGGESTION");
        if (suggestions.length > 0) {
          mdBody += `### 💡 Suggestions (${suggestions.length})\n`;
          for (const i of suggestions) {
            mdBody += `#### ${i.title}\n`;
            mdBody += `**File**: \`${i.filePath ? `${i.filePath}:${i.lineNumber ?? "any"}` : "PR-wide"}\` | **Why**: ${i.description}\n`;
            mdBody += `**Fix**: ${i.suggestion}\n\n`;
          }
        }

        mdBody += `---\n`;
        if (diffData.truncated) {
          mdBody += `*Reviewed ${diffData.keptFiles.length} of ${diffData.totalFilesCount} changed files (budget limit reached)*\n`;
        }
        if (!pr.featureRequestId) {
          mdBody += `*No Claire feature request was linked — this review covers code quality, security, and production risks only.*\n`;
        } else {
          mdBody += `*[claire-request-${pr.featureRequestId}]*\n`;
        }

        // Build inline comments — only for issues with both filePath and lineNumber
        const inlineComments = reviewResult.issues
          .filter((i): i is typeof i & { filePath: string; lineNumber: number } =>
            i.filePath != null && i.lineNumber != null
          )
          .map((i) => ({
            path: i.filePath,
            line: i.lineNumber,
            body: `**${i.severity}**: ${i.title}\n\n**Why**: ${i.description}\n\n**Fix**: ${i.suggestion}`,
          }));

        const [owner, repoName] = pr.repository.fullName.split("/");

        try {
          // Attempt inline review (may fail with 422 or any other GitHub API error)
          await postPullRequestReview({
            owner,
            repo: repoName,
            prNumber: pr.githubPrNumber,
            installationId,
            body: mdBody,
            comments: inlineComments.length > 0 ? inlineComments : undefined,
          });
        } catch (reviewErr) {
          // Fallback: plain comment — guarantees the review body always lands
          console.warn(
            `[claire] postPullRequestReview failed (PR #${pr.githubPrNumber}), falling back to comment:`,
            reviewErr
          );
          await postPullRequestComment({
            owner,
            repo: repoName,
            prNumber: pr.githubPrNumber,
            installationId,
            body: mdBody,
          });
        }
      });

      await logStep("posting_github", "done", "Posted review to GitHub");
    } catch (err: any) {
      // ------------------------------------------------------------------
      // Failure path:
      //  1. Write a "failed" workflow step to both entities (best-effort)
      //  2. Mark the ai_reviews row as "failed" if it was created (best-effort)
      //  3. Re-throw so Inngest marks the run as failed and can retry
      // ------------------------------------------------------------------
      try {
        await logStep("failed", "failed", `Failed: ${String(err?.message ?? err)}`);
      } catch {
        // logStep itself could fail — swallow to ensure we still update DB
      }

      if (reviewId !== null) {
        try {
          await step.run("mark_review_failed", async () => {
            await db
              .update(aiReviews)
              .set({ status: "failed" })
              .where(
                and(
                  eq(aiReviews.id, reviewId!),
                  eq(aiReviews.status, "running") // idempotent: only update if still running
                )
              );
          });
        } catch {
          // Swallow DB error so original error is re-thrown cleanly
        }
      }

      throw err;
    }
  }
);
