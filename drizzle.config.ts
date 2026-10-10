import { defineConfig } from "drizzle-kit";

if (!process.env.DIRECT_DATABASE_URL) {
  throw new Error("DIRECT_DATABASE_URL is required for drizzle-kit commands (migrations bypass the pooler).");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Migrations must run against the direct connection; the app uses the pooled string.
  dbCredentials: { url: process.env.DIRECT_DATABASE_URL },
  strict: true,
  verbose: true,
});