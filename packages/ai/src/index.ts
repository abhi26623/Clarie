import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject, type CoreMessage } from "ai";
import { z } from "zod";
import { env } from "@claire/config/env";

// Lazy singleton — created on first use, not at module load time.
let _client: ReturnType<typeof createOpenRouter> | null = null;
function getClient() {
  if (!_client) {
    const apiKey = env.OPENROUTER_API_KEY;
    // Fail early with a clear message rather than a vague 401 from OpenRouter
    if (!apiKey || apiKey === "your_openrouter_api_key_here") {
      throw new Error("OPENROUTER_API_KEY is missing from the server environment. Set it in apps/web/.env.");
    }
    if (process.env.NODE_ENV !== "production") {
      console.log("[ai] OpenRouter key present:", apiKey.slice(0, 8) + "...");
    }
    _client = createOpenRouter({ apiKey });
  }
  return _client;
}

type ModelPurpose = "light" | "default" | "review" | "premiumReview";

function getModelName(purpose: ModelPurpose): string {
  switch (purpose) {
    case "light": return env.OPENROUTER_MODEL_LIGHT;
    case "default": return env.OPENROUTER_MODEL_DEFAULT;
    case "review": return env.OPENROUTER_MODEL_REVIEW;
    case "premiumReview": return env.OPENROUTER_MODEL_PREMIUM_REVIEW;
  }
}

function getFallbackPurpose(purpose: ModelPurpose): ModelPurpose | null {
  switch (purpose) {
    case "premiumReview": return "review";
    case "review": return "default";
    case "default": return "light";
    case "light": return null;
  }
}

export async function generateObjectResilient<T>(options: {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  maxAttempts?: number;
  timeoutMs?: number;
  modelPurpose?: ModelPurpose;
}): Promise<T> {
  let currentPurpose = options.modelPurpose ?? "default";
  const maxAttempts = options.maxAttempts ?? 2;
  const timeoutMs = options.timeoutMs ?? (maxAttempts === 1 ? 48_000 : 24_000);
  let attempt = 0;
  let lastError: unknown = null;
  const messages: CoreMessage[] = [{ role: "user", content: options.prompt }];

  while (attempt < maxAttempts) {
    try {
      const modelName = getModelName(currentPurpose);
      const model = getClient()(modelName);
      
      const result = await generateObject({
        model,
        schema: options.schema,
        system: options.system,
        messages,
        abortSignal: AbortSignal.timeout(timeoutMs),
      });
      return result.object;
    } catch (e: any) {
      lastError = e;
      attempt++;

      // Check for 404 No endpoints found or model unavailable
      const isModelUnavailable = e.message?.includes("No endpoints found") || e.message?.includes("404") || e.name === "APICallError" && e.statusCode === 404;
      if (isModelUnavailable) {
        const fallback = getFallbackPurpose(currentPurpose);
        if (fallback) {
          console.log(`[ai] OpenRouter model unavailable, retrying with fallback (${currentPurpose} -> ${fallback})`);
          currentPurpose = fallback;
          // Don't count fallback as a schema failure attempt
          attempt--; 
          continue;
        } else {
          throw new Error(`OpenRouter model unavailable and no further fallbacks for purpose: ${currentPurpose}. Last error: ${e.message}`);
        }
      }

      const isRepairableError =
        e.name === "TypeValidationError" ||
        e.name === "JSONParseError" ||
        e.message?.includes("Validation");

      if (isRepairableError && attempt < maxAttempts) {
        const raw: string =
          typeof e.text === "string" ? e.text :
          typeof e.value === "string" ? e.value :
          typeof e.cause?.text === "string" ? e.cause.text :
          "{}";
        messages.push({ role: "assistant", content: raw });
        messages.push({
          role: "user",
          content: `Your previous response failed schema validation. Error: ${e.message}. Fix the JSON and try again.`,
        });
      } else {
        throw e;
      }
    }
  }

  throw lastError;
}

export * from "ai";