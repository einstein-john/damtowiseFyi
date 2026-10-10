import { Hono } from "hono";
import type { TagSummary } from "../../contracts/index.js";
import { cacheableJson, publicCacheControl } from "../../lib/http/cache.js";
import { listAllTags } from "../../services/tags-service.js";
import type { AppEnv } from "../../types.js";

export function createPublicTagRoutes(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.get("/tags", async (c) => {
    const rows = await listAllTags(c.get("services"));
    const payload: TagSummary[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
    }));

    return cacheableJson(c, payload, { cacheControl: publicCacheControl() });
  });

  return app;
}