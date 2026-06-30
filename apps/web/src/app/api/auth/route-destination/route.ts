import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveDestination } from "@claire/auth/routing";
import { auth } from "@claire/auth";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  const returnTo = cookies().get("returnTo")?.value;
  
  const dest = await resolveDestination(session, returnTo);
  
  if (returnTo) {
    cookies().delete("returnTo");
  }
  
  redirect(dest);
}
