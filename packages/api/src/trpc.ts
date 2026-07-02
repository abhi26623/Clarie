import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { auth, ensureActiveOrganization } from "@claire/auth";
import { DEMO_EMAIL, DEMO_ORG_ID, DEMO_ORG_SLUG } from "@claire/auth/demo";
import { db, organization } from "@claire/db";
import { eq } from "drizzle-orm";
import type { Session } from "@claire/auth";

export async function createContext(opts: { headers: Headers }) {
  const session = await auth.api.getSession({ headers: opts.headers });
  let orgPromise: ReturnType<typeof ensureActiveOrganization> | null = null;
  const getActiveOrg = () => {
    if (!session?.user) return Promise.resolve(null);
    if (!orgPromise) orgPromise = ensureActiveOrganization(session.user.id, session.session.id);
    return orgPromise;
  };
  return { session, headers: opts.headers, getActiveOrg };
}
export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, session: ctx.session } });
});

export const protectedOrgProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const result = await ctx.getActiveOrg();
  if (!result) throw new TRPCError({ code: "FORBIDDEN", message: "No active organization" });
  
  // 🔥 GLOBAL DEMO GUARD
  // If the user is the demo user, they are strictly quarantined to the DEMO_ORG_SLUG workspace.
  if (ctx.session.user.email === DEMO_EMAIL) {
    const [demoOrg] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, DEMO_ORG_SLUG))
      .limit(1);
    if (!demoOrg || result.orgId !== demoOrg.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Demo account is restricted to the demo workspace." });
    }
  }

  return next({ ctx: { ...ctx, orgId: result.orgId, memberRole: result.memberRole } });
});
