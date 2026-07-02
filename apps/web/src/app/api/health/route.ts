import { db } from "@claire/db";
import { sql } from "drizzle-orm";
export const dynamic = "force-dynamic";
export async function GET() {
  try { await db.execute(sql`select 1`); return new Response("ok"); }
  catch { return new Response("db error", { status: 500 }); }
}
