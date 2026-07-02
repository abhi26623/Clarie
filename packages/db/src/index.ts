import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set — check your .env / config env schema.");
}
const client = postgres(process.env.DATABASE_URL, {
  prepare: false,
  idle_timeout: 20,
  connect_timeout: 10,
});
export const db = drizzle(client, { schema });
export * from "./schema";
export * from "./plans";
export * from "./credits";
export { schema };
export * from "drizzle-orm";
