import { db, featureRequests, workflowSteps, workspaceSettings } from "@claire/db";
import { sql, ne, isNull, eq, and, count, asc } from "drizzle-orm";

async function audit() {
  console.log("=== PHASE 0 READ-ONLY AUDIT ===\n");

  // ── 1. Orphan linkedFeatureId check ───────────────────────────────
  console.log("--- 1. Orphan linkedFeatureId check ---");
  try {
    const orphans = await db
      .select({ id: featureRequests.id, linkedFeatureId: featureRequests.linkedFeatureId })
      .from(featureRequests)
      .where(
        and(
          isNull(
            sql`(SELECT 1 FROM ${featureRequests} p WHERE p.id = ${featureRequests.linkedFeatureId})`
          ),
          ne(featureRequests.linkedFeatureId, sql`NULL`)
        )
      );
    // Simpler approach using raw SQL for the NOT EXISTS pattern
    const rawOrphans = await db.execute(sql`
      SELECT id, linked_feature_id 
      FROM feature_requests f
      WHERE f.linked_feature_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM feature_requests p WHERE p.id = f.linked_feature_id)
    `);
    console.log(`Orphan rows found: ${rawOrphans.length}`);
    if (rawOrphans.length > 0) {
      for (const row of rawOrphans) {
        console.log(`  id=${row.id}, linked_feature_id=${row.linked_feature_id} (orphan)`);
      }
      console.log("  ACTION NEEDED: These rows need linked_feature_id set to NULL before adding FK.");
    } else {
      console.log("  OK: No orphan references. Safe to add FK.");
    }
  } catch (e: any) {
    console.log(`  ERROR: ${e.message}`);
  }
  console.log();

  // ── 2. Duplicate github_installation_id check ─────────────────────
  console.log("--- 2. Duplicate github_installation_id check ---");
  try {
    const dupes = await db.execute(sql`
      SELECT github_installation_id, COUNT(*) as cnt
      FROM workspace_settings
      WHERE github_installation_id IS NOT NULL
      GROUP BY github_installation_id
      HAVING COUNT(*) > 1
    `);
    console.log(`Duplicate installation IDs found: ${dupes.length}`);
    if (dupes.length > 0) {
      for (const row of dupes) {
        console.log(`  installation_id=${row.github_installation_id}, count=${row.cnt}`);
      }
      console.log("  ACTION NEEDED: Resolve duplicates before adding .unique() constraint.");
    } else {
      console.log("  OK: No duplicates. Safe to add .unique().");
    }
  } catch (e: any) {
    console.log(`  ERROR: ${e.message}`);
  }
  console.log();

  // ── 3. Enum completeness check ───────────────────────────────────
  console.log("--- 3. Enum completeness check ---");
  try {
    // Get enum values from DB
    const enumResult = await db.execute(sql`
      SELECT unnest(enum_range(NULL::feature_status)) as val
    `);
    const dbEnumValues = enumResult.map((r: any) => r.val);
    console.log("feature_status enum values in DB:", dbEnumValues);

    // Get distinct statuses in actual use
    const usedStatuses = await db
      .select({ status: featureRequests.status })
      .from(featureRequests)
      .groupBy(featureRequests.status);
    const usedValues = usedStatuses.map((r) => r.status);
    console.log("Distinct statuses in feature_requests table:", usedValues);

    // Check for gaps
    const missingInEnum = usedValues.filter((s) => !dbEnumValues.includes(s));
    const missingInDb = dbEnumValues.filter((s) => !usedValues.includes(s));

    if (missingInEnum.length > 0) {
      console.log(`  CRITICAL: Statuses in DB rows but NOT in enum: ${missingInEnum.join(", ")}`);
    } else {
      console.log("  OK: All in-use statuses exist in enum.");
    }
    if (missingInDb.length > 0) {
      console.log(`  INFO: Enum values not yet used in data: ${missingInDb.join(", ")}`);
    }
  } catch (e: any) {
    console.log(`  ERROR: ${e.message}`);
  }
  console.log();

  // Task statuses too
  console.log("--- 3b. Task status enum check ---");
  try {
    const enumResult = await db.execute(sql`
      SELECT unnest(enum_range(NULL::task_status)) as val
    `);
    const dbEnumValues = enumResult.map((r: any) => r.val);
    console.log("task_status enum values in DB:", dbEnumValues);

    // Need to import taskStatus enum to check schema values
    const { taskStatus } = await import("@claire/db");
    const schemaValues = taskStatus.enumValues;
    console.log("task_status enum values in schema.ts:", schemaValues);

    const missingInDb = schemaValues.filter((s) => !dbEnumValues.includes(s));
    const missingInSchema = dbEnumValues.filter((s) => !schemaValues.includes(s));

    if (missingInDb.length > 0) {
      console.log(`  CRITICAL: Schema has values not in DB enum: ${missingInDb.join(", ")}`);
    }
    if (missingInSchema.length > 0) {
      console.log(`  CRITICAL: DB has values not in schema: ${missingInSchema.join(", ")}`);
    }
    if (missingInDb.length === 0 && missingInSchema.length === 0) {
      console.log("  OK: Schema and DB enums match.");
    }
  } catch (e: any) {
    console.log(`  ERROR: ${e.message}`);
  }
  console.log();

  // ── 4. workflowSteps usage grep (code) ──────────────────────────
  console.log("--- 4. workflowSteps usage in code ---");
  // This is a code check, not DB. We'll report what we find.
  console.log("  (Run via grep externally - see below)");
  console.log();

  console.log("=== AUDIT COMPLETE ===");
  process.exit(0);
}

audit().catch((e) => {
  console.error("Audit failed:", e);
  process.exit(1);
});
