import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { auth, ensureActiveOrganization } from "@claire/auth";
import { DEMO_EMAIL, DEMO_ORG_ID } from "@claire/auth/demo";
import type { Session } from "@claire/auth";

export async function createContext(opts: { headers: Headers }) {
  const session = (await auth.api.getSession({ headers: opts.headers })) as Session | null;
  return { session, headers: opts.headers };
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
  const result = await ensureActiveOrganization(ctx.session.user.id, ctx.session.session.id);
  if (!result) throw new TRPCError({ code: "FORBIDDEN", message: "No active organization" });
  
  // 🔥 GLOBAL DEMO GUARD
  // If the user is the demo user, they are strictly quarantined to the DEMO_ORG_ID.
  if (ctx.session.user.email === DEMO_EMAIL && result.orgId !== DEMO_ORG_ID) {
     throw new TRPCError({ code: "FORBIDDEN", message: "Demo account is restricted to the demo workspace." });
  }

  return next({ ctx: { ...ctx, orgId: result.orgId, memberRole: result.memberRole } });
});
