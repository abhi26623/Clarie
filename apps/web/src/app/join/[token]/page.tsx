import { db, inviteLinks, member, workspaceSettings, session as sessionTable, organization } from "@claire/db";
import { auth } from "@claire/auth";
import type { Auth } from "@claire/auth";
import { DEMO_EMAIL } from "@claire/auth/demo";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, sql, and } from "drizzle-orm";

import { DemoLogoutRedirect } from "./DemoLogoutRedirect";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: { token: string } }) {
  const token = params.token;
  
  // 1. Validate token
  const [invite] = await db.select().from(inviteLinks).where(eq(inviteLinks.token, token));
  const now = new Date();
  
  const isInvalid = !invite || new Date(invite.expiresAt) < now;
  
  const session = await auth.api.getSession({ headers: headers() });
  
  if (isInvalid) {
    if (session?.user) {
      // CRITICAL: if expired/garbage and signed in with no org, stranded user
      const [firstMemb] = await db.select().from(member).where(eq(member.userId, session.user.id)).limit(1);
      if (!firstMemb) {
        return (
          <main className="container p-10 flex flex-col items-center justify-center text-center">
            <h1 className="text-2xl font-bold mb-4">Invalid or Expired Invite</h1>
            <p className="text-ink-secondary mb-6">This invite link is no longer valid or has expired.</p>
            <a href="/onboarding" className="btn btn-primary">Create your own workspace</a>
          </main>
        );
      }
      return (
        <main className="container p-10 flex flex-col items-center justify-center text-center">
          <h1 className="text-2xl font-bold mb-4">Invalid or Expired Invite</h1>
          <p className="text-ink-secondary mb-6">This invite link is no longer valid or has expired.</p>
          <a href="/dashboard" className="btn btn-primary">Go to Dashboard</a>
        </main>
      );
    }
    return (
      <main className="container p-10 flex flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-bold mb-4">Invalid or Expired Invite</h1>
        <p className="text-ink-secondary mb-6">This invite link is no longer valid or has expired.</p>
        <a href="/sign-up" className="btn btn-primary">Sign Up</a>
      </main>
    );
  }

  // Auto-logout if demo user to prevent cross-tenant contamination
  if (session?.user && session.user.email === DEMO_EMAIL) {
    return <DemoLogoutRedirect returnTo={`/sign-up?returnTo=/join/${token}`} />;
  }

  if (!session?.user) {
    redirect(`/sign-up?returnTo=/join/${token}`);
  }

  // Check if they are ALREADY a member
  const [existingMember] = await db.select().from(member)
    .where(and(eq(member.organizationId, invite.organizationId), eq(member.userId, session.user.id)));
    
  // 2. Check Member Limits (10 members max on FREE tier)
  let isFull = false;
  if (!existingMember) {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` })
      .from(member)
      .where(eq(member.organizationId, invite.organizationId));
      
    const [settings] = await db.select().from(workspaceSettings)
      .where(eq(workspaceSettings.organizationId, invite.organizationId));

    if (settings && count >= settings.memberLimit) {
      isFull = true;
    }
  }

  if (isFull) {
    return (
      <main className="container p-10 flex flex-col items-center justify-center text-center mt-20">
        <div className="card p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold mb-4" style={{ fontSize: "var(--text-xl)" }}>Workspace is Full</h1>
          <p className="text-ink-secondary mb-6" style={{ fontSize: "var(--text-sm)" }}>This workspace has reached its member limit.</p>
          <a href="/dashboard" className="btn btn-primary w-full flex justify-center">Go to Dashboard</a>
        </div>
      </main>
    );
  }

  const [org] = await db.select().from(organization).where(eq(organization.id, invite.organizationId));

  async function joinAction() {
    "use server";
    
    const freshSession = await auth.api.getSession({ headers: headers() });
    if (!freshSession?.user || freshSession.user.email === DEMO_EMAIL) {
      throw new Error("Unauthorized");
    }
    
    // Server-side re-validation of token to prevent bypass
    const [freshInvite] = await db.select().from(inviteLinks).where(eq(inviteLinks.token, token));
    if (!freshInvite || new Date(freshInvite.expiresAt) < new Date()) {
      throw new Error("Invite is invalid or expired");
    }
    
    // Insert membership idempotently using freshly fetched orgId
    try {
      const memberId = crypto.randomUUID();
      await db.insert(member).values({
        id: memberId,
        organizationId: freshInvite.organizationId,
        userId: freshSession.user.id,
        role: "member",
        createdAt: new Date(),
      }).onConflictDoNothing(); 
    } catch (err) {}

    await (auth as Auth).api.setActiveOrganization({
      headers: headers(),
      body: { organizationId: freshInvite.organizationId },
    });

    redirect("/dashboard");
  }

  return (
    <main className="container flex flex-col items-center justify-center text-center" style={{ marginTop: "var(--space-20)", marginBottom: "var(--space-20)" }}>
      <div className="card w-full" style={{ maxWidth: 440, padding: "var(--space-8)" }}>
        <h1 style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-2)" }}>{existingMember ? "Workspace Invite" : "Join Workspace"}</h1>
        <p style={{ color: "var(--ink-secondary)", fontSize: "var(--text-sm)", marginBottom: "var(--space-8)" }}>
          {existingMember ? (
            <>You are already a member of <strong>{org?.name || "the workspace"}</strong>.</>
          ) : (
            <>You've been invited to join <strong>{org?.name || "the workspace"}</strong>.</>
          )}
        </p>
        <form action={joinAction}>
          <button type="submit" className="btn btn-primary" style={{ width: "100%", height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {existingMember ? "Go to Workspace" : "Join Workspace"}
          </button>
        </form>
      </div>
    </main>
  );
}
