import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { mediaIdParamSchema, mediaListQuerySchema, mediaPatchSchema } from "../../contracts/index.js";
import { MAX_UPLOAD_BYTES } from "../../contracts/index.js";
import { privateJson } from "../../lib/http/cache.js";
import { badRequest, payloadTooLarge, unsupportedMediaType } from "../../lib/http/errors.js";
import { toMediaSummary } from "../../serializers/media.js";
import {
  createMedia,
  deleteMedia,
  listMediaPage,
  parseMediaFields,
  updateMedia,
} from "../../services/media-service.js";
import type { AppEnv } from "../../types.js";

/** Reads the single `file` part of a multipart upload, with a hard size cap. */
async function readUploadedFile(form: FormData): Promise<File> {
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw unsupportedMediaType('A file part named "file" is required');
  }
  if (file.size === 0) throw badRequest("Uploaded file is empty");
  if (file.size > MAX_UPLOAD_BYTES) {
    throw payloadTooLarge(`File exceeds the ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB limit`);
  }
  return file;
}

function readTextFields(form: FormData): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") fields[key] = value;
  }
  return fields;
}

export function createAdminMediaRoutes(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.get("/media", zValidator("query", mediaListQuerySchema), async (c) => {
    const services = c.get("services");
    const { page, pageSize } = c.req.valid("query");
    const result = await listMediaPage(services, { page, pageSize });

    return privateJson(c, {
      items: result.items.map((item) => toMediaSummary(item, services.env.CLOUDINARY_CLOUD_NAME)),
      page,
      pageSize,
      total: result.total,
    });
  });

  app.post("/media", async (c) => {
    const services = c.get("services");
    const form = await c.req.formData();

    const file = await readUploadedFile(form);
    const fields = parseMediaFields(readTextFields(form));

    const created = await createMedia(services, {
      file: {
        filename: file.name,
        declaredMimeType: file.type,
        bytes: Buffer.from(await file.arrayBuffer()),
      },
      fields,
    });

    return privateJson(c, toMediaSummary(created, services.env.CLOUDINARY_CLOUD_NAME), 201);
  });

  app.patch(
    "/media/:id",
    zValidator("param", mediaIdParamSchema),
    zValidator("json", mediaPatchSchema),
    async (c) => {
      const services = c.get("services");
      const updated = await updateMedia(services, c.req.valid("param").id, c.req.valid("json"));
      return privateJson(c, toMediaSummary(updated, services.env.CLOUDINARY_CLOUD_NAME));
    },
  );

  app.delete("/media/:id", zValidator("param", mediaIdParamSchema), async (c) => {
    await deleteMedia(c.get("services"), c.req.valid("param").id);
    return c.body(null, 204);
  });

  return app;
}