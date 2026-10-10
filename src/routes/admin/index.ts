import { Hono } from "hono";
import type { Env } from "../../config/env.js";
import type { RateLimiter } from "../../lib/rate-limit.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { requireAdmin } from "../../middleware/require-admin.js";
import type { AppEnv, AppMiddleware } from "../../types.js";
import { createAdminMediaRoutes } from "./media.js";
import { createMeRoutes } from "./me.js";
import { createAdminPostRoutes } from "./posts.js";
import { createAdminTagRoutes } from "./tags.js";
import { createAdminWorklogRoutes } from "./worklog.js";

export interface AdminRouterOptions {
  env: Env;
  readLimiter: RateLimiter;
  writeLimiter: RateLimiter;
}

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/** Writes get a tighter budget than reads so a stolen token cannot drain credits. */
function limitWrites(limiter: RateLimiter): AppMiddleware {
  const writeLimit = rateLimit({ limiter, bucket: "admin-write" });

  return async (c, next) => {
    if (!MUTATING_METHODS.has(c.req.method)) return next();
    return writeLimit(c, next);
  };
}

/** Every route under `/admin` requires a valid admin JWT; writes are rate limited. */
export function createAdminRouter(options: AdminRouterOptions): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use("/admin/*", rateLimit({ limiter: options.readLimiter, bucket: "admin-read" }));
  app.use("/admin/*", requireAdmin(options.env));
  app.use("/admin/*", limitWrites(options.writeLimiter));

  app.route("/admin", createMeRoutes());
  app.route("/admin", createAdminPostRoutes());
  app.route("/admin", createAdminMediaRoutes());
  app.route("/admin", createAdminTagRoutes());
  app.route("/admin", createAdminWorklogRoutes());

  return app;
}