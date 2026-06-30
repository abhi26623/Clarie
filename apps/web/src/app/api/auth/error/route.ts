import { NextResponse } from "next/server";

export function GET(req: Request) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  // Route BetterAuth errors back to sign-in page to be handled gracefully
  return NextResponse.redirect(new URL(`/sign-in?error=${error || "unknown"}`, req.url));
}
