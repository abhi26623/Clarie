import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, inArray, and } from "drizzle-orm";
import * as schema from "./src/schema";

const queryClient = postgres("postgresql://neondb_owner:npg_bDoclWP9CIX7@ep-morning-scene-aoe8uto9-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require");
const db = drizzle(queryClient, { schema });

async function main() {
  const stuck = await db.select({
    id: schema.featureRequests.id,
    status: schema.featureRequests.status,
  })
  .from(schema.featureRequests)
  .where(inArray(schema.featureRequests.status, ["analyzing", "prd_generating"]));

  if (stuck.length === 0) {
    console.log("No requests bouncing in analyzing/prd_generating.");
    process.exit(0);
  }

  console.log(`Found ${stuck.length} requests in analyzing/prd_generating. Checking for PRDs...`);

  for (const req of stuck) {
    const existingPrd = await db.query.prds.findFirst({
      where: eq(schema.prds.featureRequestId, req.id)
    });

    if (existingPrd) {
      console.log(`Request #${req.id} has a PRD but is stuck in '${req.status}'. Healing to 'prd_ready'.`);
      await db.update(schema.featureRequests)
        .set({ status: "prd_ready" })
        .where(eq(schema.featureRequests.id, req.id));
    } else {
      console.log(`Request #${req.id} does not have a PRD. Leaving as '${req.status}'.`);
    }
  }
  process.exit(0);
}

main().catch(console.error);
