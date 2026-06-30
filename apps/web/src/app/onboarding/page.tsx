import { auth, ensureActiveOrganization } from "@claire/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import OnboardingClient from "./client";

import { resolveDestination } from "@claire/auth/routing";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await auth.api.getSession({ headers: headers() });
  const dest = await resolveDestination(session);

  if (dest !== "/onboarding") {
    redirect(dest);
  }

  return <OnboardingClient />;
}
