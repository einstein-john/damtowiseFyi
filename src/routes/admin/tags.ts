import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { idParamSchema, tagInputSchema, tagPatchSchema, type TagSummary } from "../../contracts/index.js";
import { privateJson } from "../../lib/http/cache.js";
import { createTag, deleteTag, listAllTags, updateTagById } from "../../services/tags-service.js";
import type { TagRow } from "../../db/schema.js";
import type { AppEnv } from "../../types.js";

function toSummary(row: TagRow): TagSummary {
  return { id: row.id, name: row.name, slug: row.slug };
}

export function createAdminTagRoutes(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.get("/tags", async (c) => {
    const rows = await listAllTags(c.get("services"));
    return privateJson(c, rows.map(toSummary));
  });

  app.post("/tags", zValidator("json", tagInputSchema), async (c) => {
    const created = await createTag(c.get("services"), c.req.valid("json"));
    return privateJson(c, toSummary(created), 201);
  });

  app.patch(
    "/tags/:id",
    zValidator("param", idParamSchema),
    zValidator("json", tagPatchSchema),
    async (c) => {
      const updated = await updateTagById(
        c.get("services"),
        c.req.valid("param").id,
        c.req.valid("json"),
      );
      return privateJson(c, toSummary(updated));
    },
  );

  app.delete("/tags/:id", zValidator("param", idParamSchema), async (c) => {
    await deleteTag(c.get("services"), c.req.valid("param").id);
    return c.body(null, 204);
  });

  return app;
}