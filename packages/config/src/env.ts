import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(16),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  OPENROUTER_API_KEY: z.string().min(1),
  INNGEST_EVENT_KEY: z.string().default("local"),
  INNGEST_SIGNING_KEY: z.string().default("signkey-local-placeholder"),
  GITHUB_APP_ID: z.string().optional().default(""),
  GITHUB_APP_PRIVATE_KEY: z.string().optional().default(""),
  GITHUB_APP_WEBHOOK_SECRET: z.string().optional().default(""),
  GITHUB_APP_CLIENT_ID: z.string().optional().default(""),
  GITHUB_APP_CLIENT_SECRET: z.string().optional().default(""),
  RAZORPAY_KEY_ID: z.string().optional().default(""),
  RAZORPAY_KEY_SECRET: z.string().optional().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(""),
});

// Validate lazily so build steps that don't need every var don't crash.
export const env = (() => {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid / missing environment variables:\n${issues}\n\nCopy .env.example to .env and fill it in.`);
  }
  return parsed.data;
})();

export type Env = z.infer<typeof schema>;
