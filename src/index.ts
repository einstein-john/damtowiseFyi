import { serve } from "@hono/node-server";
import { createApp, type RateLimiters } from "./app.js";
import { loadEnv } from "./config/env.js";
import { createDatabase } from "./db/client.js";
import { configureCloudinary } from "./lib/media/cloudinary.js";
import { DebouncedDeployHook } from "./lib/publish/deploy-hook.js";
import { RateLimiter, startRateLimiterSweep } from "./lib/rate-limit.js";
import type { ServiceContext } from "./services/context.js";
import { createPostScheduler } from "./services/post-scheduler-service.js";

const env = loadEnv();
const { db, pool } = createDatabase(env.DATABASE_URL);
const cloudinary = configureCloudinary(env);

const deployHook = new DebouncedDeployHook({
  url: env.VERCEL_DEPLOY_HOOK_URL,
  debounceMs: env.DEPLOY_DEBOUNCE_MS,
});

const services: ServiceContext = { env, db, cloudinary, deployHook };

const limiters: RateLimiters = {
  adminRead: new RateLimiter(env.ADMIN_READ_RATE_LIMIT, env.RATE_LIMIT_WINDOW_MS),
  adminWrite: new RateLimiter(env.ADMIN_WRITE_RATE_LIMIT, env.RATE_LIMIT_WINDOW_MS),
  webhook: new RateLimiter(env.WEBHOOK_RATE_LIMIT, env.RATE_LIMIT_WINDOW_MS),
};

const app = createApp({ env, services, limiters });
const scheduler = createPostScheduler(services);

async function main(): Promise<void> {
  if (env.SCHEDULER_ENABLED) {
    await scheduler.start();
    console.log("[scheduler] armed");
  }

  const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    console.log(`[api] listening on http://localhost:${info.port}`);
  });

  const stopSweeps = Object.values(limiters).map((limiter) => startRateLimiterSweep(limiter));

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[api] ${signal} received, shutting down`);
    scheduler.stop();
    stopSweeps.forEach((stop) => stop());
    // Spend a queued deploy hook rather than losing the trigger on restart.
    await deployHook.flush();
    await server.close();
    await pool.end();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main();