import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { db, webhookLogs, repositories } from "@claire/db";
import { inngest } from "@claire/jobs";
import { env } from "@claire/config/env";
import { eq, and } from "drizzle-orm";
import { upsertPullRequestFromWebhook } from "@claire/api";


export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256") ?? "";
  const event = req.headers.get("x-github-event") ?? "unknown";

  // Compute HMAC-SHA256 signature
  if (!env.GITHUB_APP_WEBHOOK_SECRET) {
    return new Response("Webhook secret not configured", { status: 500 });
  }
  const hmac = crypto.createHmac("sha256", env.GITHUB_APP_WEBHOOK_SECRET);
  hmac.update(rawBody);
  const expectedSignature = `sha256=${hmac.digest("hex")}`;

  let signatureValid = false;
  try {
    const sigBuf = Buffer.from(signature, "utf8");
    const expBuf = Buffer.from(expectedSignature, "utf8");
    if (sigBuf.length === expBuf.length) {
      signatureValid = crypto.timingSafeEqual(sigBuf, expBuf);
    }
  } catch (e) {
    signatureValid = false;
  }

  if (!signatureValid) {
    // Log invalid signature — do not parse JSON, store only a safe body preview
    try {
      await db.insert(webhookLogs).values({
        source: "github",
        event,
        payload: { rawBodyPreview: rawBody.slice(0, 2000), reason: "invalid_signature" },
        signatureValid: false,
      });
    } catch {
      // If logging fails, still return 200 — never let a DB error escape
    }
    return NextResponse.json({ received: true, processed: false }, { status: 200 });
  }

  // Parse JSON only after verification
  let payload: any = {};
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    await db.insert(webhookLogs).values({
      source: "github",
      event,
      payload: { error: "invalid_json", raw: rawBody.slice(0, 2000) },
      signatureValid: true,
      processedAt: new Date().toISOString(),
    });
    return NextResponse.json({ received: true, error: "invalid_json" }, { status: 200 });
  }

  try {
    // Store parsed payload in webhook_logs with signatureValid: true — inside try so a DB failure returns 200
    await db.insert(webhookLogs).values({
      source: "github",
      event,
      payload,
      signatureValid: true,
      processedAt: new Date().toISOString(),
    });

    if (event === "installation" && payload.action === "created") {
      const installationId = payload.installation.id;
      if (payload.repositories && Array.isArray(payload.repositories)) {
        for (const repo of payload.repositories) {
          await db.update(repositories)
            .set({ installationId, webhookActive: true })
            .where(and(eq(repositories.githubId, repo.id),
                       eq(repositories.installationId, installationId)));
        }
      }
      return NextResponse.json({ received: true, action: "installation.created" }, { status: 200 });
    }

    if (event === "installation_repositories") {
      const installationId = payload.installation.id;
      if (payload.repositories_added && Array.isArray(payload.repositories_added)) {
        for (const repo of payload.repositories_added) {
          await db.update(repositories)
            .set({ installationId, webhookActive: true })
            .where(and(eq(repositories.githubId, repo.id),
                       eq(repositories.installationId, installationId)));
        }
      }
      if (payload.repositories_removed && Array.isArray(payload.repositories_removed)) {
        for (const repo of payload.repositories_removed) {
          await db.update(repositories)
            .set({ installationId: null, webhookActive: false })
            .where(and(eq(repositories.githubId, repo.id),
                       eq(repositories.installationId, installationId)));
        }
      }
      return NextResponse.json({ received: true, action: "installation_repositories" }, { status: 200 });
    }

    if (event === "pull_request") {
      const { action } = payload;

      // Upsert PR row + parse claire-request-<id> via shared helper (no orgId — discovers org)
      const result = await upsertPullRequestFromWebhook(payload);
      if (!result) {
        return NextResponse.json({ received: true, skipped: "repository not matched or not connected" }, { status: 200 });
      }

      const { pullRequestId, repositoryId, organizationId, githubPrNumber, installationId } = result;

      if (action === "opened") {
        await inngest.send({
          name: "github/pr.opened",
          data: { repositoryId, pullRequestId, organizationId, githubPrNumber, installationId },
        });
      }

      if (action === "synchronize") {
        await inngest.send({
          name: "github/pr.synchronize",
          data: { repositoryId, pullRequestId, organizationId, githubPrNumber, installationId },
        });
      }

      return NextResponse.json({ received: true, action: `pull_request.${action}` }, { status: 200 });
    }

    return NextResponse.json({ received: true, skipped: `unhandled event: ${event}` }, { status: 200 });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ received: true, error: "internal error" }, { status: 200 });
  }
}
