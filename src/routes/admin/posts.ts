import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  idParamSchema,
  postInputSchema,
  postListQuerySchema,
  postPatchSchema,
  type PostDetail,
} from "../../contracts/index.js";
import type { PostWithTags } from "../../db/queries/posts.js";
import type { MediaRow } from "../../db/schema.js";
import { privateJson } from "../../lib/http/cache.js";
import { toPostDetail, toPostSummary } from "../../serializers/post.js";
import {
  coverFor,
  createPost,
  deletePost,
  getPost,
  listAll,
  loadCovers,
  updatePost,
} from "../../services/posts-service.js";
import { inspectPublishReadiness, publishPost, unpublishPost } from "../../services/publish-service.js";
import type { AppEnv } from "../../types.js";

function toDetail(
  row: PostWithTags,
  covers: Map<string, MediaRow>,
  cloudName: string,
): PostDetail {
  return toPostDetail({ post: row.post, tags: row.tags, cover: coverFor(row, covers), cloudName });
}

export function createAdminPostRoutes(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.get("/posts", zValidator("query", postListQuerySchema), async (c) => {
    const services = c.get("services");
    const { page, pageSize } = c.req.valid("query");
    const result = await listAll(services, { page, pageSize });
    const covers = await loadCovers(services, result.items);

    return privateJson(c, {
      items: result.items.map((item) =>
        toPostSummary({
          post: item.post,
          tags: item.tags,
          cover: coverFor(item, covers),
          cloudName: services.env.CLOUDINARY_CLOUD_NAME,
        }),
      ),
      page,
      pageSize,
      total: result.total,
    });
  });

  app.get("/posts/:id", zValidator("param", idParamSchema), async (c) => {
    const services = c.get("services");
    const found = await getPost(services, c.req.valid("param").id);
    const covers = await loadCovers(services, [found]);
    return privateJson(c, toDetail(found, covers, services.env.CLOUDINARY_CLOUD_NAME));
  });

  app.post(
    "/posts",
    zValidator("json", postInputSchema),
    async (c) => {
      const services = c.get("services");
      const created = await createPost(services, c.req.valid("json"));
      const covers = await loadCovers(services, [created]);
      return privateJson(c, toDetail(created, covers, services.env.CLOUDINARY_CLOUD_NAME), 201);
    },
  );

  app.patch(
    "/posts/:id",
    zValidator("param", idParamSchema),
    zValidator("json", postPatchSchema),
    async (c) => {
      const services = c.get("services");
      const updated = await updatePost(services, c.req.valid("param").id, c.req.valid("json"));
      const covers = await loadCovers(services, [updated]);
      return privateJson(c, toDetail(updated, covers, services.env.CLOUDINARY_CLOUD_NAME));
    },
  );

  app.delete("/posts/:id", zValidator("param", idParamSchema), async (c) => {
    await deletePost(c.get("services"), c.req.valid("param").id);
    return c.body(null, 204);
  });

  app.post("/posts/:id/publish", zValidator("param", idParamSchema), async (c) => {
    const post = await publishPost(c.get("services"), c.req.valid("param").id);
    return privateJson(c, { id: post.id, status: post.status, ogImageUrl: post.ogImageUrl });
  });

  app.post("/posts/:id/unpublish", zValidator("param", idParamSchema), async (c) => {
    const post = await unpublishPost(c.get("services"), c.req.valid("param").id);
    return privateJson(c, { id: post.id, status: post.status });
  });

  /** Reports why a post cannot publish yet, without changing anything. */
  app.get("/posts/:id/publish-readiness", zValidator("param", idParamSchema), async (c) => {
    const issues = await inspectPublishReadiness(c.get("services"), c.req.valid("param").id);
    return privateJson(c, { ready: issues.length === 0, issues });
  });

  return app;
}