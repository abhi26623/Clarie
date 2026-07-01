import { auth } from "./index";
import {
  db,
  user,
  session,
  member,
  organization,
  workspaceSettings,
  eq,
} from "@claire/db";
import { PLAN_LIMITS } from "@claire/db";

// ─── Canonical constants — never read from request ────────────────────────────
export const DEMO_EMAIL = "demo@claire.app";
export const DEMO_PASSWORD = "demo123456";
export const DEMO_ORG_SLUG = "claire-demo";
export const DEMO_ORG_NAME = "Claire Demo";
export const DEMO_USER_NAME = "Demo User";
export const DEMO_ORG_ID = "seed-org-demo";
export const DEMO_USER_ID = "seed-user-demo";
export const DEMO_MEMBER_ID = "seed-member-demo";
 
// For idempotency, we rely on organizationId unique constraint for workspaceSettings.

export async function ensureDemoWorkspace() {
  // ── Step 1: Org self-heal ──────────────────────────────────────────────────
  await db
    .insert(organization)
    .values({
      id: DEMO_ORG_ID,
      name: DEMO_ORG_NAME,
      slug: DEMO_ORG_SLUG,
      createdAt: new Date(),
    })
    .onConflictDoNothing();

  const [demoOrg] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, DEMO_ORG_SLUG))
    .limit(1);

  if (!demoOrg) {
    throw new Error("Demo org not found after self-heal");
  }

  // ── Step 2: workspace_settings self-heal ───────────────────────────────────
  await db
    .insert(workspaceSettings)
    .values({
      organizationId: demoOrg.id,
      portalSlug: DEMO_ORG_SLUG,
      plan: "FREE",
      aiCreditsLimit: PLAN_LIMITS.FREE.credits,
      aiCreditsUsed: 120, // non-zero so usage meter shows progress
      repoLimit: PLAN_LIMITS.FREE.repos,
      memberLimit: PLAN_LIMITS.FREE.members,
      billingStatus: "active",
      productDescription: "An AI-powered product management workspace designed to accelerate shipping.",
    })
    .onConflictDoUpdate({
      target: [workspaceSettings.organizationId],
      set: {
        plan: "FREE",
        aiCreditsLimit: 500,
        aiCreditsUsed: 120,
        repoLimit: 3,
        productDescription: "An AI-powered product management workspace designed to accelerate shipping.",
      },
    });

  // ── Step 3: User self-heal via BetterAuth ──────────────────────────────────
  try {
    await auth.api.signUpEmail({
      body: {
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        name: DEMO_USER_NAME,
      },
    });
  } catch {
    // User already exists — continue
  }

  const [demoUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, DEMO_EMAIL))
    .limit(1);

  if (!demoUser) {
    throw new Error("Demo user not found after self-heal");
  }

  // Ensure emailVerified = true
  await db
    .update(user)
    .set({ emailVerified: true })
    .where(eq(user.id, demoUser.id));

  // ── Step 4: Member self-heal ───────────────────────────────────────────────
  await db
    .insert(member)
    .values({
      id: DEMO_MEMBER_ID,
      organizationId: demoOrg.id,
      userId: demoUser.id,
      role: "owner",
      createdAt: new Date(),
    })
    .onConflictDoNothing();

  return { demoOrg, demoUser };
}
