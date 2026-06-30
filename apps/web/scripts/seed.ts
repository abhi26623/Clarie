import { 
  db, featureRequests, prds, tasks, aiReviews, reviewIssues, 
  approvals, webhookLogs, repositories, clarificationThreads 
} from "@claire/db";
import { ensureDemoWorkspace, DEMO_ORG_ID, DEMO_USER_ID } from "@claire/auth/demo";

async function seed() {
  console.log("Seeding judge-ready demo workspace...");
  
  // 1. Ensure the core identity exists using BetterAuth + exact IDs
  const { demoOrg, demoUser } = await ensureDemoWorkspace();
  const orgId = demoOrg.id;
  const userId = demoUser.id;

  // 2. Insert repository for Webhook and PRs
  const REPO_ID = 99999;
  await db.insert(repositories).values({
    id: REPO_ID,
    organizationId: orgId,
    fullName: "claire-demo/frontend",
    name: "frontend",
    githubId: 1234567,
    installationId: 7654321,
    webhookActive: true,
    createdAt: new Date().toISOString(),
  }).onConflictDoNothing();

  const pullRequests = (await import("@claire/db")).pullRequests;
  await db.insert(pullRequests).values({
    id: 999,
    repositoryId: REPO_ID,
    githubPrNumber: 999,
    title: "Test PR",
    state: "open",
  }).onConflictDoNothing();

  // Helper to quickly insert requests safely
  const seedFeature = async (
    id: number,
    title: string,
    status: any,
    body: string,
    timeToShipDays: number | null,
    createdAtDaysAgo: number
  ) => {
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - createdAtDaysAgo);

    await db.insert(featureRequests).values({
      id,
      organizationId: orgId,
      source: "portal",
      submitterName: "Demo User",
      submitterEmail: "demo@claire.app",
      title,
      body,
      status,
      timeToShipDays,
      createdAt: createdAt.toISOString(),
    }).onConflictDoNothing();
    return id;
  };

  // 1. [SHIPPED] "Dark mode for the settings page" (The Hero)
  const feat1 = 1001;
  await seedFeature(feat1, "Dark mode for the settings page", "shipped", "We need a dark mode toggle in the settings.", 3, 20);
  await db.insert(prds).values({ id: 1001, featureRequestId: feat1, problemStatement: "Users complain about eye strain at night.", goals: ["Add theme toggle", "Persist preference"], nonGoals: ["Auto-schedule theme"], userStories: [], acceptanceCriteria: ["Toggle exists", "Default is light", "Dark theme works", "Persists to DB"], edgeCases: ["Local storage wiped", "Network offline"], successMetrics: ["10% usage"], approved: true, version: 1 }).onConflictDoNothing();
  const tasksFeat1 = [
    { id: 1001, title: "Add toggle UI", type: "FEATURE" as const, priority: "MEDIUM" as const, status: "done" as const },
    { id: 1002, title: "Update color tokens", type: "FEATURE" as const, priority: "HIGH" as const, status: "done" as const },
    { id: 1003, title: "Persist preference", type: "FEATURE" as const, priority: "MEDIUM" as const, status: "done" as const },
    { id: 1004, title: "Write tests", type: "TEST" as const, priority: "LOW" as const, status: "done" as const },
  ];
  for (const t of tasksFeat1) {
    await db.insert(tasks).values({ ...t, featureRequestId: feat1, assigneeId: userId }).onConflictDoNothing();
  }
  // AI Review 1 (FAILED) with Blocking issue
  await db.insert(aiReviews).values({ id: 1001, featureRequestId: feat1, pullRequestId: 999, status: "completed", summary: "Missing null check.", passed: false, confidence: 95, reviewNumber: 1 }).onConflictDoNothing();
  await db.insert(reviewIssues).values({ id: 1001, reviewId: 1001, type: "CODE_QUALITY", severity: "BLOCKING", title: "Missing null check on user preferences", description: "fix user?.preferences?.theme ?? 'light'", filePath: "src/components/ThemeToggle.tsx", lineNumber: 42 }).onConflictDoNothing();
  // AI Review 2 (PASSED)
  await db.insert(aiReviews).values({ id: 1002, featureRequestId: feat1, pullRequestId: 999, status: "completed", summary: "Looks good.", passed: true, confidence: 87, reviewNumber: 2 }).onConflictDoNothing();
  // Approval
  await db.insert(approvals).values({ id: 1001, featureRequestId: feat1, reviewerId: userId, decision: "approved", notes: "LGTM!" }).onConflictDoNothing();

  // 1b. [SHIPPED] "User profile avatars" (Extra shipped)
  const feat1b = 1010;
  await seedFeature(feat1b, "User profile avatars", "shipped", "Allow users to upload an avatar.", 4, 18);
  await db.insert(prds).values({ id: 1010, featureRequestId: feat1b, problemStatement: "Profiles look bland.", goals: ["Avatar upload"], nonGoals: [], userStories: [], acceptanceCriteria: ["Upload button", "Cropper UI", "Max size 5MB"], edgeCases: [], successMetrics: [], approved: true, version: 1 }).onConflictDoNothing();
  await db.insert(tasks).values({ id: 1020, featureRequestId: feat1b, title: "S3 upload integration", type: "FEATURE", priority: "HIGH", status: "done", assigneeId: userId }).onConflictDoNothing();
  await db.insert(aiReviews).values({ id: 1010, featureRequestId: feat1b, pullRequestId: 999, status: "completed", summary: "Security passed.", passed: true, confidence: 92, reviewNumber: 1 }).onConflictDoNothing();
  await db.insert(approvals).values({ id: 1010, featureRequestId: feat1b, reviewerId: userId, decision: "approved", notes: "Approved!" }).onConflictDoNothing();

  // 1c. [SHIPPED] "Email receipts" (Extra shipped)
  const feat1c = 1011;
  await seedFeature(feat1c, "Email receipts", "shipped", "Send receipts upon payment.", 2, 16);
  await db.insert(prds).values({ id: 1011, featureRequestId: feat1c, problemStatement: "Compliance requirements.", goals: ["PDF receipts"], nonGoals: [], userStories: [], acceptanceCriteria: ["Sent via SendGrid"], edgeCases: [], successMetrics: [], approved: true, version: 1 }).onConflictDoNothing();
  await db.insert(tasks).values({ id: 1021, featureRequestId: feat1c, title: "SendGrid setup", type: "CHORE", priority: "MEDIUM", status: "done", assigneeId: userId }).onConflictDoNothing();
  await db.insert(aiReviews).values({ id: 1011, featureRequestId: feat1c, pullRequestId: 999, status: "completed", summary: "Looks clean.", passed: true, confidence: 89, reviewNumber: 1 }).onConflictDoNothing();
  await db.insert(approvals).values({ id: 1011, featureRequestId: feat1c, reviewerId: userId, decision: "approved" }).onConflictDoNothing();

  // 2. [READY_FOR_APPROVAL] "CSV export for reports"
  const feat2 = 1002;
  await seedFeature(feat2, "CSV export for reports", "ready_for_approval", "Export all reports as CSV.", null, 10);
  await db.insert(prds).values({ id: 1002, featureRequestId: feat2, problemStatement: "Can't analyze data in Excel.", goals: ["Export to CSV"], nonGoals: [], userStories: [], acceptanceCriteria: ["Download button"], edgeCases: [], successMetrics: [], approved: true, version: 1 }).onConflictDoNothing();
  await db.insert(tasks).values({ id: 1005, featureRequestId: feat2, title: "Add export button", type: "FEATURE", priority: "MEDIUM", status: "done", assigneeId: userId }).onConflictDoNothing();
  await db.insert(aiReviews).values({ id: 1003, featureRequestId: feat2, pullRequestId: 999, status: "completed", summary: "All logic works.", passed: true, confidence: 90, reviewNumber: 1 }).onConflictDoNothing();

  // 3. [FIX_NEEDED] "Two-factor authentication"
  const feat3 = 1003;
  await seedFeature(feat3, "Two-factor authentication", "fix_needed", "Add 2FA support via TOTP.", null, 5);
  await db.insert(prds).values({ id: 1003, featureRequestId: feat3, problemStatement: "Need better security.", goals: ["Support TOTP"], nonGoals: ["SMS 2FA"], userStories: [], acceptanceCriteria: ["Scan QR code"], edgeCases: [], successMetrics: [], approved: true, version: 1 }).onConflictDoNothing();
  await db.insert(tasks).values({ id: 1006, featureRequestId: feat3, title: "Implement TOTP", type: "FEATURE", priority: "HIGH", status: "done", assigneeId: userId }).onConflictDoNothing();
  await db.insert(aiReviews).values({ id: 1004, featureRequestId: feat3, pullRequestId: 999, status: "completed", summary: "Security flaw detected.", passed: false, confidence: 99, reviewNumber: 1 }).onConflictDoNothing();
  await db.insert(reviewIssues).values({ id: 1002, reviewId: 1004, type: "SECURITY", severity: "BLOCKING", title: "Missing rate limit on 2FA endpoint", description: "Add rate limiting to prevent brute force.", filePath: "src/api/2fa.ts", lineNumber: 15 }).onConflictDoNothing();

  // 4. [PRD_READY] "Custom roles & permissions"
  const feat4 = 1004;
  await seedFeature(feat4, "Custom roles & permissions", "prd_ready", "Allow defining custom roles.", null, 3);
  await db.insert(prds).values({ id: 1004, featureRequestId: feat4, problemStatement: "Users want custom access.", goals: ["Role builder"], nonGoals: [], userStories: [], acceptanceCriteria: ["UI for roles"], edgeCases: [], successMetrics: [], approved: false, version: 1 }).onConflictDoNothing();

  // 5. [PENDING / received] "Mobile app"
  const feat5 = 1005;
  await seedFeature(feat5, "Mobile app", "received", "Build a React Native mobile app.", null, 1);

  // 6. [IN_DEVELOPMENT] "Slack notifications"
  const feat6 = 1006;
  await seedFeature(feat6, "Slack notifications", "in_development", "Notify Slack on ship.", null, 8);
  await db.insert(prds).values({ id: 1005, featureRequestId: feat6, problemStatement: "Visibility.", goals: ["Slack webhook"], nonGoals: [], userStories: [], acceptanceCriteria: ["Bot posts message"], edgeCases: [], successMetrics: [], approved: true, version: 1 }).onConflictDoNothing();
  await db.insert(tasks).values({ id: 1007, featureRequestId: feat6, title: "Slack OAuth", type: "FEATURE", priority: "MEDIUM", status: "in_progress", assigneeId: userId }).onConflictDoNothing();
  
  // 7. [TASKS_READY] "Audit log"
  const feat7 = 1007;
  await seedFeature(feat7, "Audit log", "tasks_ready", "Keep track of all actions.", null, 12);
  await db.insert(prds).values({ id: 1006, featureRequestId: feat7, problemStatement: "Compliance.", goals: ["Record events"], nonGoals: [], userStories: [], acceptanceCriteria: ["Table UI"], edgeCases: [], successMetrics: [], approved: true, version: 1 }).onConflictDoNothing();
  await db.insert(tasks).values({ id: 1008, featureRequestId: feat7, title: "Log middleware", type: "FEATURE", priority: "MEDIUM", status: "todo", assigneeId: userId }).onConflictDoNothing();

  // 8. [NEEDS_CLARIFICATION / clarification_needed] "Make the dashboard faster"
  const feat8 = 1008;
  await seedFeature(feat8, "Make the dashboard faster", "clarification_needed", "It is too slow.", null, 15);
  await db.insert(clarificationThreads).values({ id: 1001, featureRequestId: feat8, question: "Which specific page on the dashboard is feeling slow for you? (e.g. initial load, switching tabs, etc.)", questionType: "TEXT", askedAt: new Date().toISOString() }).onConflictDoNothing();

  // ── Webhook Replay (Offline Safe) ──────────────────────────────────────────
  await db.insert(webhookLogs).values({
    id: 9999,
    source: "github",
    event: "pull_request",
    payload: {
      action: "opened",
      number: 999,
      repository: { id: 1234567, full_name: "claire-demo/frontend" },
      installation: { id: 7654321 },
      pull_request: { title: "Test PR", user: { login: "demo" }, head: { ref: "feature" }, base: { ref: "main" } }
    },
    signatureValid: true,
    processedAt: null,
  }).onConflictDoNothing();

  console.log("Seeded successfully.");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seed error:", err);
  process.exit(1);
});
