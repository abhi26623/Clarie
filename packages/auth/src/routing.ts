import { db, session as sessionTable, member, eq } from "@claire/db";
import type { Session } from "./index";

export function isSafeReturnTo(value: string | null | undefined): boolean {
  if (!value) return false;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("//")) {
    return false;
  }
  return value.startsWith("/join/");
}

export async function resolveDestination(
  sessionInfo: Session | null | undefined,
  returnToCookie?: string | null
): Promise<string> {
  if (isSafeReturnTo(returnToCookie)) {
    return returnToCookie!;
  }

  if (!sessionInfo || !sessionInfo.session || !sessionInfo.user) {
    return "/sign-in";
  }

  const { session, user } = sessionInfo;

  if (session.activeOrganizationId) {
    return "/dashboard";
  }

  // Check if they have ANY organization
  const [firstMemb] = await db.select().from(member).where(eq(member.userId, user.id)).limit(1);
  
  if (!firstMemb) {
    return "/onboarding";
  }

  // AUTO-SET to most recent membership
  await db.update(sessionTable)
    .set({ activeOrganizationId: firstMemb.organizationId })
    .where(eq(sessionTable.id, session.id));

  return "/dashboard";
}
