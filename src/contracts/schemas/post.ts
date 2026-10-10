import { z } from "zod";
import { POST_STATUSES } from "../domain.js";
import { isoDateTime, slugSchema, uuid } from "./common.js";

export const EXCERPT_MAX_LENGTH = 300;
export const SEO_TITLE_MAX_LENGTH = 70;
export const SEO_DESCRIPTION_MAX_LENGTH = 180;

const postFields = {
  title: z.string().trim().min(1).max(200),
  slug: slugSchema.optional(),
  excerpt: z.string().trim().max(EXCERPT_MAX_LENGTH).nullish(),
  contentMd: z.string().max(400_000),
  coverMediaId: uuid.nullish(),
  status: z.enum(POST_STATUSES),
  publishedAt: isoDateTime.nullish(),
  seoTitle: z.string().trim().max(SEO_TITLE_MAX_LENGTH).nullish(),
  seoDescription: z.string().trim().max(SEO_DESCRIPTION_MAX_LENGTH).nullish(),
  canonicalUrl: z.string().url().max(500).nullish(),
  noindex: z.boolean(),
  tagIds: z.array(uuid).max(20),
};

export const postInputSchema = z.object({
  ...postFields,
  status: postFields.status.default("draft"),
  noindex: postFields.noindex.default(false),
  tagIds: postFields.tagIds.default([]),
});

export const postPatchSchema = z
  .object(postFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "at least one field is required" });

export type PostInput = z.infer<typeof postInputSchema>;
export type PostPatch = z.infer<typeof postPatchSchema>;

export const postListQuerySchema = z.object({
  tag: slugSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type PostListQuery = z.infer<typeof postListQuerySchema>;