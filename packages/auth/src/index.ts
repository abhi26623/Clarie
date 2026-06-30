import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { db, session, member, eq, and } from "@claire/db";

if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
  console.warn("⚠️ WARNING: GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET is missing. GitHub OAuth login will fail.");
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  emailAndPassword: { enabled: true },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["github"],
    },
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      scope: ["read:user", "user:email"],
    },
  },
  trustedOrigins: process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_APP_URL || ""] : ["http://localhost:3000"],
  plugins: [organization()],
});

export type Session = typeof auth.$Infer.Session;
export type Auth = typeof auth;

export async function ensureActiveOrganization(
  userId: string,
  sessionId: string,
): Promise<{ orgId: string; memberRole: string } | null> {
  // 1. Load current session row from DB
  const [sess] = await db.select().from(session).where(eq(session.id, sessionId));
  if (!sess) return null;

  if (sess.activeOrganizationId) {
    // Verify the user is actually a member of that org
    const [memb] = await db.select().from(member).where(and(
      eq(member.organizationId, sess.activeOrganizationId),
      eq(member.userId, userId),
    ));
    // Zero-write fast path — role is free here
    if (memb) return { orgId: sess.activeOrganizationId, memberRole: memb.role };
  }

  // If missing or invalid, query the member table for the user's first org
  const [firstMemb] = await db.select().from(member).where(eq(member.userId, userId)).limit(1);
  if (!firstMemb) return null;

  // Update the current session row with that organization id
  await db.update(session)
    .set({ activeOrganizationId: firstMemb.organizationId })
    .where(eq(session.id, sessionId));

  return { orgId: firstMemb.organizationId, memberRole: firstMemb.role };
}

export * from "./routing";
