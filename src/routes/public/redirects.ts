import { Hono } from "hono";
import type { SlugRedirect } from "../../contracts/index.js";
import { cacheableJson, publicCacheControl } from "../../lib/http/cache.js";
import { listRedirects } from "../../db/queries/redirects.js";
import { withRetry } from "../../db/client.js";
import type { AppEnv } from "../../types.js";

/** The static site reads this at build time to emit redirect pages. */
export function createPublicRedirectRoutes(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.get("/redirects", async (c) => {
    const { db } = c.get("services");
    const rows = await withRetry(() => listRedirects(db));
    const payload: SlugRedirect[] = rows.map((row) => ({
      oldSlug: row.oldSlug,
      newSlug: row.newSlug,
    }));

    return cacheableJson(c, payload, { cacheControl: publicCacheControl() });
  });

  return app;
}