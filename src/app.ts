import { Hono } from "hono";
import type { Env } from "./config/env.js";
import { RateLimiter } from "./lib/rate-limit.js";
import { cors, securityHeaders } from "./middleware/cors.js";
import { onError } from "./middleware/on-error.js";
import { EventDedupeStore } from "./lib/auth/event-dedupe.js";
import { createAdminRouter } from "./routes/admin/index.js";
import { createHealthRoutes } from "./routes/health.js";
import { createPublicPostRoutes } from "./routes/public/posts.js";
import { createPublicRedirectRoutes } from "./routes/public/redirects.js";
import { createPublicTagRoutes } from "./routes/public/tags.js";
import { createPublicWorklogRoutes } from "./routes/public/worklog.js";
import { createNeonAuthWebhookRoutes } from "./routes/webhooks/neon-auth.js";
import type { ServiceContext } from "./services/context.js";
import type { AppEnv } from "./types.js";

export interface CreateAppOptions {
  env: Env;
  services: ServiceContext;
  limiters: RateLimiters;
}

export interface RateLimiters {
  adminRead: RateLimiter;
  adminWrite: RateLimiter;
  webhook: RateLimiter;
}

/**
 * Wires middleware and routes. The database is never touched at construction
 * time, so booting is safe even when Neon is suspended.
 */
export function createApp(options: CreateAppOptions): Hono<AppEnv> {
  const { env, services, limiters } = options;
  const app = new Hono<AppEnv>();

  app.use("*", securityHeaders(env));
  app.use("*", cors(env));

  app.use("*", async (c, next) => {
    c.set("services", services);
    await next();
  });

  app.onError(onError);

  app.route("/", createHealthRoutes());
  app.route("/", createPublicPostRoutes());
  app.route("/", createPublicTagRoutes());
  app.route("/", createPublicWorklogRoutes());
  app.route("/", createPublicRedirectRoutes());

  app.route(
    "/",
    createNeonAuthWebhookRoutes({
      env,
      limiter: limiters.webhook,
      dedupeStore: new EventDedupeStore(env.WEBHOOK_SIGNATURE_MAX_AGE_SECONDS * 2_000),
    }),
  );

  app.route(
    "/",
    createAdminRouter({
      env,
      readLimiter: limiters.adminRead,
      writeLimiter: limiters.adminWrite,
    }),
  );

  return app;
}