import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createContext } from "@claire/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = async (req: Request) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      try {
        return await createContext({ headers: req.headers });
      } catch (e) {
        console.error("[ROUTE] createContext threw:", e);
        throw e;
      }
    },
    onError: ({ path, error }) => {
      if (error.code !== "NOT_FOUND") {
        console.error("[ROUTE] tRPC error:", path, error.code, error.message);
      }
    },
  });
};

export { handler as GET, handler as POST };
