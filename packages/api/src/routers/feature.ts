import { z } from "zod";
import { router, publicProcedure, protectedOrgProcedure } from "../trpc";
import { db, featureRequests, clarificationThreads, workspaceSettings, workflowSteps, member, AI_CREDIT_COSTS, getRemainingCredits, consumeAiCredits, CreditsExhaustedError, CREDITS_EXHAUSTED_SENTINEL, featureStatus, organization } from "@claire/db";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, isNull, or, inArray, lt, notInArray } from "drizzle-orm";
import { inngest } from "@claire/jobs";
import { ensureActiveOrganization } from "@claire/auth";
import { DEMO_EMAIL, DEMO_ORG_ID, DEMO_ORG_SLUG } from "@claire/auth/demo";
import { generateObjectResilient } from "@claire/ai";
import { POST_TRIAGE_PHASES, getWorkspaceExistingFeaturesContext, TRIAGE_SYSTEM_PROMPT, decisionSchema } from "../lib/triage";

export const featureRouter = router({
  list: protectedOrgProcedure.query(async ({ ctx }) => {
    return db.select().from(featureRequests)
      .where(eq(featureRequests.organizationId, ctx.orgId))
      .orderBy(desc(featureRequests.createdAt));
  }),

  getById: protectedOrgProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const result = await db.query.featureRequests.findFirst({
        where: and(
          eq(featureRequests.id, input.id),
          eq(featureRequests.organizationId, ctx.orgId)
        ),
        with: {
          prd: true,
          tasks: true,
          aiReviews: { with: { issues: true } },
          clarificationThreads: true,
          pullRequests: { with: { repository: true } },
        }
      });
      if (!result) throw new TRPCError({ code: "NOT_FOUND" });
      return result;
    }),

  submit: publicProcedure
    .input(z.object({
      portalSlug: z.string().optional(),
      organizationId: z.string().optional(),
      title: z.string().min(3),
      body: z.string().min(3),
      submitterName: z.string().optional(),
      submitterEmail: z.string().email("Enter a valid email").optional().or(z.literal("")),
    }))
    .mutation(async ({ input, ctx }) => {
      let targetOrgId: string | null = null;
      let source = "portal";
      let canViewDashboard = false;

      if (ctx.session?.user && ctx.session?.session) {
        const result = await ensureActiveOrganization(ctx.session.user.id, ctx.session.session.id);
        targetOrgId = result?.orgId ?? null;
        if (targetOrgId) {
          source = "dashboard";
          canViewDashboard = true;
        }

        if (ctx.session?.user?.email === DEMO_EMAIL) {
          const check = await ensureActiveOrganization(ctx.session.user.id, ctx.session.session.id);
          const [demoOrg] = await db
            .select({ id: organization.id })
            .from(organization)
            .where(eq(organization.slug, DEMO_ORG_SLUG))
            .limit(1);
          if (!demoOrg || check?.orgId !== demoOrg.id) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Demo account is restricted to the demo workspace.",
            });
          }
        }
      }

      if (!targetOrgId) {
        if (!input.portalSlug) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Portal slug is required for public submissions" });
        }
        const [settings] = await db.select().from(workspaceSettings).where(eq(workspaceSettings.portalSlug, input.portalSlug));
        if (!settings) {
          throw new TRPCError({ 
            code: "NOT_FOUND", 
            message: `No workspace found for portal "${input.portalSlug}". Check the portal slug in settings.` 
          });
        }
        targetOrgId = settings.organizationId;
      }

      // ── Credit pre-check (synchronous, read-only) ──────────────────────
      // We check triage cost only — the cheapest operation in the chain.
      // If the workspace can't afford even 1 credit, block immediately.
      // The Inngest function will atomically consume credits per step.
      const credits = await getRemainingCredits(targetOrgId);
      if (credits.remaining < AI_CREDIT_COSTS.triage) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "AI credits exhausted for this workspace. Upgrade to Pro to continue.",
        });
      }

      const trackingToken = crypto.randomUUID();

      const [created] = await db.insert(featureRequests).values({
        organizationId: targetOrgId,
        title: input.title, body: input.body,
        submitterName: input.submitterName, submitterEmail: input.submitterEmail,
        source, status: "received",
        trackingToken,
      }).returning();
      
      // Write initial workflow step so portal/dashboard polling shows progress immediately
      await db.insert(workflowSteps).values({
        entityType: "feature_request",
        entityId: String(created.id),
        step: "starting",
        status: "done",
        partialResult: { label: "Received your request" },
      });

      try {
        await db.insert(workflowSteps).values({
          entityType: "feature_request",
          entityId: String(created.id),
          step: "analyze",
          status: "running",
          partialResult: { label: "Analyzing your request" },
        });

        await db.update(featureRequests)
          .set({ status: "analyzing" })
          .where(and(eq(featureRequests.id, created.id), notInArray(featureRequests.status, ["analyzing", "prd_generating", ...POST_TRIAGE_PHASES] as any)));

        const existingContext = await getWorkspaceExistingFeaturesContext(targetOrgId, created.id);
        const result = await generateObjectResilient({
          schema: decisionSchema,
          system: TRIAGE_SYSTEM_PROMPT,
          prompt: `Feature request title: "${created.title}"\nDetails: "${created.body}"${existingContext}\n\nClassify and decide how to handle it.`,
          modelPurpose: "light",
          maxAttempts: 1,
          timeoutMs: 55_000,
        });

        // Consume triage credit AFTER successful classification.
        try {
          await consumeAiCredits(targetOrgId, AI_CREDIT_COSTS.triage);
        } catch (err: any) {
          if (err instanceof CreditsExhaustedError) {
            await db.update(featureRequests)
              .set({ status: "failed", aiReasoning: `${CREDITS_EXHAUSTED_SENTINEL}${err.message}` })
              .where(eq(featureRequests.id, created.id));
            await db.insert(workflowSteps).values({
              entityType: "feature_request", entityId: String(created.id), step: "failed", status: "failed", partialResult: { label: "Credits exhausted" }
            });
            return { id: created.id, organizationId: targetOrgId, trackingToken, canViewDashboard };
          }
          throw err;
        }

        if (result.decision === "clarification_needed" && result.clarification) {
          await db.insert(clarificationThreads).values({
            featureRequestId: created.id,
            question: result.clarification.question,
            questionType: result.clarification.questionType ?? "TEXT",
            options: result.clarification.options ?? null,
          });
          await db.update(featureRequests)
            .set({ status: "clarification_needed", aiDecision: result.decision, aiReasoning: result.reasoning })
            .where(eq(featureRequests.id, created.id));
          await db.insert(workflowSteps).values({
            entityType: "feature_request", entityId: String(created.id), step: "clarification", status: "done", partialResult: { label: "Clarification needed", question: result.clarification.question }
          });
          return { id: created.id, organizationId: targetOrgId, trackingToken, canViewDashboard };
        }

        if (result.decision === "duplicate" || result.decision === "feature_exists" || result.decision === "out_of_scope" || result.decision === "bug_report") {
          const labelMap: Record<string, string> = {
            duplicate: "Duplicate request",
            feature_exists: "Feature already exists",
            out_of_scope: "Out of scope",
            bug_report: "Bug report received"
          };
          await db.update(featureRequests)
            .set({ status: result.decision, aiDecision: result.decision, aiReasoning: result.reasoning })
            .where(eq(featureRequests.id, created.id));
          await db.insert(workflowSteps).values({
            entityType: "feature_request", entityId: String(created.id), step: "classified", status: "done", partialResult: { label: labelMap[result.decision] || "Classified", reasoning: result.reasoning }
          });
          return { id: created.id, organizationId: targetOrgId, trackingToken, canViewDashboard };
        }

        // decision === "proceed"
        await db.update(featureRequests)
          .set({ status: "prd_generating" })
          .where(eq(featureRequests.id, created.id));
          
        await db.insert(workflowSteps).values({
          entityType: "feature_request", entityId: String(created.id), step: "prd", status: "running", partialResult: { label: "Generating product requirements" }
        });
        
        await inngest.send({ name: "feature/prd.generate", data: { featureRequestId: created.id, organizationId: targetOrgId }, id: `prd-gen-${created.id}` }); // Double-submit dedup!

      } catch (error) {
        console.error("Inline triage failed:", error);
        // Graceful error handling: flip running steps to failed, leave feature in received/analyzing to allow retry
        await db.update(workflowSteps)
          .set({ status: "failed", partialResult: { label: "AI triage failed (retryable)" } })
          .where(and(eq(workflowSteps.entityType, "feature_request"), eq(workflowSteps.entityId, String(created.id)), eq(workflowSteps.status, "running")));
      }

      return { id: created.id, organizationId: targetOrgId, trackingToken, canViewDashboard };
    }),

  getPublicTracking: publicProcedure
    .input(z.object({ portalSlug: z.string(), trackingToken: z.string() }))
    .query(async ({ input }) => {
      const [settings] = await db.select().from(workspaceSettings)
        .where(eq(workspaceSettings.portalSlug, input.portalSlug));
      if (!settings) return null;

      const [req] = await db.select().from(featureRequests)
        .where(and(
          eq(featureRequests.organizationId, settings.organizationId),
          eq(featureRequests.trackingToken, input.trackingToken),
        ));
      if (!req) return null;

      const thread = req.status === "clarification_needed"
        ? await db.select().from(clarificationThreads)
            .where(and(
              eq(clarificationThreads.featureRequestId, req.id),
              isNull(clarificationThreads.answer),
            ))
            .orderBy(desc(clarificationThreads.askedAt))
            .limit(1)
            .then(r => r[0] ?? null)
        : null;

      const safeOptions = Array.isArray(thread?.options) ? thread.options : null;

      return {
        id: req.id,
        title: req.title,
        status: req.status,
        aiDecision: req.aiDecision,
        aiReasoning: req.aiReasoning,
        submitterName: req.submitterName,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt,
        clarificationThreadId: thread?.id ?? null,
        clarificationQuestion: thread?.question ?? null,
        clarificationQuestionType: thread?.questionType ?? null,
        clarificationOptions: safeOptions ?? null,
      };
    }),

  answerPublicClarification: publicProcedure
    .input(z.object({
      portalSlug: z.string(),
      trackingToken: z.string(),
      clarificationThreadId: z.number(),
      answer: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const [settings] = await db.select().from(workspaceSettings)
        .where(eq(workspaceSettings.portalSlug, input.portalSlug));
      if (!settings) throw new TRPCError({ code: "NOT_FOUND" });

      // Credit pre-check: org resolved from portal slug — check before AI work
      const clarCredits = await getRemainingCredits(settings.organizationId);
      if (clarCredits.remaining < AI_CREDIT_COSTS.triage) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "AI credits exhausted for this workspace. Upgrade to Pro to continue.",
        });
      }

      const [req] = await db.select().from(featureRequests)
        .where(and(
          eq(featureRequests.organizationId, settings.organizationId),
          eq(featureRequests.trackingToken, input.trackingToken),
        ));
      if (!req) throw new TRPCError({ code: "NOT_FOUND" });

      const [thread] = await db.select().from(clarificationThreads)
        .where(eq(clarificationThreads.id, input.clarificationThreadId));
      if (!thread || thread.featureRequestId !== req.id || thread.answer !== null) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await db.update(clarificationThreads)
        .set({ answer: input.answer, answeredAt: new Date().toISOString() })
        .where(eq(clarificationThreads.id, thread.id));

      await db.update(featureRequests)
        .set({ status: "analyzing" })
        .where(eq(featureRequests.id, req.id));

      await inngest.send({
        name: "feature/clarification.answered",
        data: { featureRequestId: req.id, organizationId: req.organizationId, clarificationThreadId: thread.id },
      });

      return { ok: true };
    }),

  updateStatus: protectedOrgProcedure
    .input(z.object({ id: z.number(), status: z.enum(featureStatus.enumValues) }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.session?.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const [m] = await db.select().from(member).where(and(eq(member.organizationId, ctx.orgId), eq(member.userId, ctx.session.user.id)));
      if (!m || (m.role !== "admin" && m.role !== "owner")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins or owners can perform this action" });
      }
      const [updated] = await db.update(featureRequests)
        .set({ status: input.status })
        .where(and(eq(featureRequests.id, input.id), eq(featureRequests.organizationId, ctx.orgId)))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  answerClarification: protectedOrgProcedure
    .input(z.object({ threadId: z.number(), featureId: z.number(), answer: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Ensure feature belongs to org
      const [feature] = await db.select().from(featureRequests)
        .where(and(eq(featureRequests.id, input.featureId), eq(featureRequests.organizationId, ctx.orgId)));
      if (!feature) throw new TRPCError({ code: "NOT_FOUND" });

      const [updated] = await db.update(clarificationThreads)
        .set({ answer: input.answer, answeredAt: new Date().toISOString() })
        .where(and(eq(clarificationThreads.id, input.threadId), eq(clarificationThreads.featureRequestId, input.featureId)))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });

      await db.update(featureRequests)
        .set({ status: "analyzing" })
        .where(and(eq(featureRequests.id, input.featureId), eq(featureRequests.organizationId, ctx.orgId)));

      await inngest.send({
        name: "feature/clarification.answered",
        data: { featureRequestId: input.featureId, organizationId: ctx.orgId, clarificationThreadId: input.threadId },
      });
      
      return updated;
    }),

  /**
   * Retry a failed intake — resets status to "received", clears aiReasoning,
   * and re-fires the feature/intake Inngest event. Org-scoped.
   */
  retryIntake: protectedOrgProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const [req] = await db.select().from(featureRequests)
        .where(and(eq(featureRequests.id, input.id), eq(featureRequests.organizationId, ctx.orgId)));
      if (!req) throw new TRPCError({ code: "NOT_FOUND" });
      if (req.status !== "failed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only failed requests can be retried." });
      }

      const [updated] = await db.update(featureRequests)
        .set({ status: "prd_generating", aiReasoning: null, aiDecision: null })
        .where(and(eq(featureRequests.id, input.id), eq(featureRequests.organizationId, ctx.orgId)))
        .returning();

      await db.insert(workflowSteps).values({
        entityType: "feature_request",
        entityId: String(input.id),
        step: "retry",
        status: "done",
        partialResult: { label: "Retrying intake" },
      });

      try {
        await inngest.send({ name: "feature/prd.generate", data: { featureRequestId: input.id, organizationId: ctx.orgId } });
      } catch (err) {
        console.error("Failed to send retry inngest event:", err);
      }

      return updated;
    }),

  /**
   * Recover stuck requests — marks requests that have been in "analyzing" or
   * "prd_generating" for more than 10 minutes as "failed" with a timeout message.
   * Uses a 10-minute threshold (not 5) to avoid killing slow-but-valid AI runs.
   * Admin/owner only.
   */
  recoverStuck: protectedOrgProcedure
    .mutation(async ({ ctx }) => {
      const [m] = await db.select().from(member)
        .where(and(eq(member.organizationId, ctx.orgId), eq(member.userId, ctx.session.user.id)));
      if (!m || (m.role !== "admin" && m.role !== "owner")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins or owners can perform this action" });
      }

      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      const stuckRows = await db.select().from(featureRequests)
        .where(and(
          eq(featureRequests.organizationId, ctx.orgId),
          inArray(featureRequests.status, ["analyzing", "prd_generating", "tasks_generating"]),
          lt(featureRequests.updatedAt, tenMinutesAgo),
        ));

      if (stuckRows.length === 0) return { recovered: 0 };

      const timeoutMsg = "The intake workflow timed out. Please retry.";

      await Promise.all(stuckRows.map(async (r) => {
        await db.update(featureRequests)
          .set({ status: "failed", aiReasoning: timeoutMsg })
          .where(eq(featureRequests.id, r.id));

        await db.insert(workflowSteps).values({
          entityType: "feature_request",
          entityId: String(r.id),
          step: "failed",
          status: "failed",
          partialResult: { label: "Timed out", message: timeoutMsg },
        });
      }));

      return { recovered: stuckRows.length };
    }),
});
