import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

const MAX_POOL_SIZE = 5;
const IDLE_TIMEOUT_MS = 10_000;
const CONNECT_TIMEOUT_MS = 10_000;

export type Database = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Pooled Neon client. `pg` is enough here: no LISTEN/NOTIFY, no interactive
 * transactions, and the free plan counts CU-hours per active connection.
 *
 * An idle client erroring out (Neon suspending compute) must not crash the process.
 */
export function createPool(connectionString: string): Pool {
  const pool = new Pool({
    connectionString,
    max: MAX_POOL_SIZE,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    ssl: { rejectUnauthorized: false },
    application_name: "damtowise-fyi-api",
  });
  pool.on("error", (error) => {
    console.error("[db] idle client error", error);
  });
  return pool;
}

/**
 * Neon suspends compute after idleness and drops pooled connections on wake,
 * so the first query of a cold period can fail on a dead socket. One retry is
 * enough; a genuine outage still surfaces.
 */
export async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isConnectionError(error)) throw error;
    console.warn("[db] retrying after a dropped connection", (error as Error).message);
    return operation();
  }
}

const CONNECTION_ERROR_CODES = new Set([
  "57P01", // admin_shutdown
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "08000", // connection_exception
  "08003", // connection_does_not_exist
  "08006", // connection_failure
  "53300", // too_many_connections
]);

function isConnectionError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return typeof code === "string" && CONNECTION_ERROR_CODES.has(code);
}

export function createDatabase(connectionString: string): { db: Database; pool: Pool } {
  const pool = createPool(connectionString);
  return { db: drizzle(pool, { schema }), pool };
}