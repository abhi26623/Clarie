import { NextRequest, NextResponse } from "next/server";
import { auth } from "@claire/auth";

// Prevent static prerendering — this route must run at request time
export const dynamic = "force-dynamic";

import {
  db,
  user,
  session,
  member,
  organization,
  workspaceSettings,
  eq,
  desc,
} from "@claire/db";
// generateId function removed as we are using shared demo identities



import { ensureDemoWorkspace, DEMO_EMAIL, DEMO_PASSWORD } from "@claire/auth/demo";

export async function GET(request: NextRequest) {
  try {
    // ── Step 1-4: Shared Self-Heal ─────────────────────────────────────────────
    const { demoOrg, demoUser } = await ensureDemoWorkspace();

    // ── Step 5: Sign in ───────────────────────────────────────────────────────
    const signInResponse = await auth.api.signInEmail({
      body: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
      asResponse: true,
    });

    if (!signInResponse.ok) {
      throw new Error(`signInEmail failed: ${signInResponse.status}`);
    }

    // ── Step 6: Set activeOrganizationId on the newest session ───────────────
    // Do NOT parse the Set-Cookie header — cookie value is URL-encoded and
    // may differ from the raw session.token in the DB.
    // Instead: find newest session row for this user by userId.
    const [newSession] = await db
      .select()
      .from(session)
      .where(eq(session.userId, demoUser.id))
      .orderBy(desc(session.createdAt))
      .limit(1);

    if (newSession) {
      await db
        .update(session)
        .set({ activeOrganizationId: demoOrg.id })
        .where(eq(session.id, newSession.id));
    }

    // ── Step 7: Build redirect and forward all Set-Cookie headers ─────────────
    const redirect = NextResponse.redirect(new URL("/dashboard", request.url));

    // Forward ALL Set-Cookie headers from BetterAuth so the session persists
    signInResponse.headers.getSetCookie().forEach((cookie) => {
      redirect.headers.append("Set-Cookie", cookie);
    });

    return redirect;
  } catch (err) {
    console.error("[demo-login] error:", err);
    // ── Step 8: Failure path ──────────────────────────────────────────────────
    return NextResponse.redirect(
      new URL("/sign-in?error=demo-unavailable", request.url),
    );
  }
}
