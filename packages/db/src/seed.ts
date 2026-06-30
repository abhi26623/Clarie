import { db } from "./index";
import { organization, user, member, workspaceSettings, featureRequests, prds } from "./schema";

// Minimal demo seed so the dashboard is never empty.
async function main() {
  const orgId = "demo-org";
  const userId = "demo-user";

  await db.insert(user).values({
    id: userId, name: "Demo Admin", email: "demo@claire.dev", emailVerified: true,
  }).onConflictDoNothing();

  await db.insert(organization).values({
    id: orgId, name: "Acme Demo", slug: "acme-demo", createdAt: new Date(),
  }).onConflictDoNothing();

  await db.insert(member).values({
    id: "demo-member", organizationId: orgId, userId, role: "owner", createdAt: new Date(),
  }).onConflictDoNothing();

  await db.insert(workspaceSettings).values({
    organizationId: orgId, productDescription: "A project management tool for small teams.",
    portalSlug: "demo-org", plan: "free",
  }).onConflictDoNothing();

  const reqs = [
    { title: "Dark mode", body: "Please add dark mode.", status: "prd_ready" as const },
    { title: "CSV export", body: "Export tasks to CSV.", status: "tasks_ready" as const },
    { title: "Broken login", body: "Login button does nothing.", status: "fix_needed" as const },
    { title: "Slack integration", body: "Notify a Slack channel on ship.", status: "ready_for_approval" as const },
    { title: "Bulk archive", body: "Archive many tasks at once.", status: "shipped" as const },
  ];
  for (const r of reqs) {
    await db.insert(featureRequests).values({
      organizationId: orgId, source: "portal", submitterName: "Customer",
      submitterEmail: "c@acme.dev", title: r.title, body: r.body, status: r.status,
    });
  }
  console.log("Seeded demo workspace.");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
