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
  baseURL: process.env.BETTER_AUTH_URL,
  trustHost: process.env.NODE_ENV === "development",
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
      scope: ["user:email", "read:user"],
      mapProfileToUser: (profile) => ({
        email: profile.email ?? `${profile.id}+${profile.login}@users.noreply.github.com`,
        name: profile.name ?? profile.login,
        image: profile.avatar_url,
      }),
    },
  },
  trustedOrigins: process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_APP_URL || ""].filter(Boolean) : ["http://localhost:3000"],
  plugins: [organization()],
});

export type Session = typeof auth.$Infer.Session;
export type Auth = typeof auth;

export async function ensureActiveOrganization(
  userId: string,
  sessionId: string,
  knownActiveOrgId?: string | null,   // NEW: from better-auth's resolved session
): Promise<{ orgId: string; memberRole: string } | null> {
  // Prefer the active org already resolved by better-auth's getSession.
  let activeOrgId = knownActiveOrgId ?? null;
  if (!activeOrgId) {
    const [sess] = await db.select().from(session).where(eq(session.id, sessionId));
    if (!sess) return null;
    activeOrgId = sess.activeOrganizationId ?? null;
  }

  if (activeOrgId) {
    const [memb] = await db.select().from(member).where(and(
      eq(member.organizationId, activeOrgId),
      eq(member.userId, userId),
    ));
    if (memb) return { orgId: activeOrgId, memberRole: memb.role };
  }

  // Fallback: user's first org (only when no valid active org is known). Persist it.
  const [firstMemb] = await db.select().from(member).where(eq(member.userId, userId)).limit(1);
  if (!firstMemb) return null;
  await db.update(session)
    .set({ activeOrganizationId: firstMemb.organizationId })
    .where(eq(session.id, sessionId));
  return { orgId: firstMemb.organizationId, memberRole: firstMemb.role };
}

export * from "./routing";
