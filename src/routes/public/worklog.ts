import { Hono } from "hono";
import { cacheableJson, publicCacheControl } from "../../lib/http/cache.js";
import { listWorklogSummaries } from "../../services/worklog-service.js";
import type { AppEnv } from "../../types.js";

export function createPublicWorklogRoutes(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.get("/worklog", async (c) => {
    return cacheableJson(c, await listWorklogSummaries(c.get("services"), true), {
      cacheControl: publicCacheControl(),
    });
  });

  return app;
}