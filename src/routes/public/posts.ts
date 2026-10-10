import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { postListQuerySchema, slugSchema } from "../../contracts/index.js";
import { cacheableJson, publicCacheControl } from "../../lib/http/cache.js";
import { notFound } from "../../lib/http/errors.js";
import { toPostDetail, toPostSummary } from "../../serializers/post.js";
import { coverFor, findPublishedBySlug, listPublished, loadCovers } from "../../services/posts-service.js";
import type { AppEnv } from "../../types.js";

/** Read-only endpoints consumed by the static build. */
export function createPublicPostRoutes(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.get("/posts", zValidator("query", postListQuerySchema), async (c) => {
    const services = c.get("services");
    const query = c.req.valid("query");

    const page = await listPublished(services, {
      tagSlug: query.tag,
      page: query.page,
      pageSize: query.pageSize,
    });

    const covers = await loadCovers(services, page.items);
    const payload = {
      items: page.items.map((item) =>
        toPostSummary({
          post: item.post,
          tags: item.tags,
          cover: coverFor(item, covers),
          cloudName: services.env.CLOUDINARY_CLOUD_NAME,
        }),
      ),
      page: query.page,
      pageSize: query.pageSize,
      total: page.total,
    };

    return cacheableJson(c, payload, { cacheControl: publicCacheControl() });
  });

  app.get("/posts/:slug", zValidator("param", z.object({ slug: slugSchema })), async (c) => {
    const services = c.get("services");
    const found = await findPublishedBySlug(services, c.req.valid("param").slug);

    if (!found) throw notFound("Post not found");

    const covers = await loadCovers(services, [found]);
    const payload = toPostDetail({
      post: found.post,
      tags: found.tags,
      cover: coverFor(found, covers),
      cloudName: services.env.CLOUDINARY_CLOUD_NAME,
    });

    return cacheableJson(c, payload, { cacheControl: publicCacheControl() });
  });

  return app;
}