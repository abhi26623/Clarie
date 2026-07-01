import { NextRequest, NextResponse } from "next/server";
import { auth } from "@claire/auth";

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo") || "/sign-up";
  
  const response = NextResponse.json({ success: true, redirectUrl: returnTo });
  
  try {
    const authResponse = await auth.api.signOut({
      headers: request.headers,
      asResponse: true,
    });
    
    // Copy all Set-Cookie headers from the auth response to clear the session cookie
    if (authResponse && authResponse.headers) {
      authResponse.headers.getSetCookie().forEach((cookie) => {
        response.headers.append("Set-Cookie", cookie);
      });
    }
  } catch (err) {
    console.error("[demo-logout] error:", err);
  }
  
  return response;
}
