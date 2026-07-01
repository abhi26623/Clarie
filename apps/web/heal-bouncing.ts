import "dotenv/config";
import { db, featureRequests, prds } from "@claire/db";
import { eq, inArray, and } from "drizzle-orm";

async function main() {
  // Find all feature requests currently stuck in analyzing or prd_generating
  const stuck = await db.select({
    id: featureRequests.id,
    status: featureRequests.status,
  })
  .from(featureRequests)
  .where(inArray(featureRequests.status, ["analyzing", "prd_generating"]));

  if (stuck.length === 0) {
    console.log("No requests bouncing in analyzing/prd_generating.");
    return;
  }

  console.log(`Found ${stuck.length} requests in analyzing/prd_generating. Checking for PRDs...`);

  for (const req of stuck) {
    const existingPrd = await db.query.prds.findFirst({
      where: eq(prds.featureRequestId, req.id)
    });

    if (existingPrd) {
      console.log(`Request #${req.id} has a PRD but is stuck in '${req.status}'. Healing to 'prd_ready'.`);
      await db.update(featureRequests)
        .set({ status: "prd_ready" })
        .where(eq(featureRequests.id, req.id));
    } else {
      console.log(`Request #${req.id} does not have a PRD. Leaving as '${req.status}'.`);
    }
  }
}

main().catch(console.error);
