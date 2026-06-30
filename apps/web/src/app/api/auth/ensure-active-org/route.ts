import { NextResponse } from "next/server";
import { auth, ensureActiveOrganization } from "@claire/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ activeOrganizationId: null }, { status: 401 });
  }

  const activeOrganizationId = await ensureActiveOrganization(session.user.id, session.session.id);
  return NextResponse.json({ activeOrganizationId });
}
