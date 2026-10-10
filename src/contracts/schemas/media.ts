import { z } from "zod";
import { slugSchema, uuid } from "./common.js";

export const tagInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  slug: slugSchema.optional(),
});

export const tagPatchSchema = z
  .object({ name: tagInputSchema.shape.name, slug: tagInputSchema.shape.slug })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "at least one field is required" });

export type TagInput = z.infer<typeof tagInputSchema>;
export type TagPatch = z.infer<typeof tagPatchSchema>;

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const mediaFieldsSchema = z.object({
  alt: z.string().trim().max(300).nullish(),
  decorative: z.boolean().default(false),
  caption: z.string().trim().max(500).nullish(),
});

export const mediaPatchSchema = mediaFieldsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "at least one field is required" });

export type MediaFields = z.infer<typeof mediaFieldsSchema>;
export type MediaPatch = z.infer<typeof mediaPatchSchema>;

export const mediaListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(40),
});

export const mediaIdParamSchema = z.object({ id: uuid });