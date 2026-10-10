import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { idParamSchema, worklogInputSchema, worklogPatchSchema } from "../../contracts/index.js";
import { privateJson } from "../../lib/http/cache.js";
import {
  createWorklogItem,
  deleteWorklogItemById,
  listWorklogSummaries,
  reorderWorklog,
  toWorklogSummary,
  updateWorklogItemById,
} from "../../services/worklog-service.js";
import type { AppEnv } from "../../types.js";

const reorderSchema = z.object({
  items: z
    .array(z.object({ id: z.string().uuid(), sortOrder: z.number().int().min(0) }))
    .max(500),
});

export function createAdminWorklogRoutes(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.get("/worklog", async (c) => {
    return privateJson(c, await listWorklogSummaries(c.get("services"), false));
  });

  app.post("/worklog", zValidator("json", worklogInputSchema), async (c) => {
    const services = c.get("services");
    const created = await createWorklogItem(services, c.req.valid("json"));
    return privateJson(c, await toWorklogSummary(services, created), 201);
  });

  app.patch(
    "/worklog/:id",
    zValidator("param", idParamSchema),
    zValidator("json", worklogPatchSchema),
    async (c) => {
      const services = c.get("services");
      const updated = await updateWorklogItemById(
        services,
        c.req.valid("param").id,
        c.req.valid("json"),
      );
      return privateJson(c, await toWorklogSummary(services, updated));
    },
  );

  app.delete("/worklog/:id", zValidator("param", idParamSchema), async (c) => {
    await deleteWorklogItemById(c.get("services"), c.req.valid("param").id);
    return c.body(null, 204);
  });

  app.post("/worklog/reorder", zValidator("json", reorderSchema), async (c) => {
    await reorderWorklog(c.get("services"), c.req.valid("json").items);
    return c.body(null, 204);
  });

  return app;
}