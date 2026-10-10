import { z } from "zod";
import { uuid } from "./common.js";

const worklogFields = {
  title: z.string().trim().min(1).max(120),
  caption: z.string().trim().max(500).nullish(),
  tag: z.string().trim().max(40).nullish(),
  sortOrder: z.number().int().min(0).max(10_000),
  published: z.boolean(),
  mediaId: uuid.nullish(),
};

export const worklogInputSchema = z.object({
  ...worklogFields,
  sortOrder: worklogFields.sortOrder.default(0),
  published: worklogFields.published.default(false),
});

export const worklogPatchSchema = z
  .object(worklogFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "at least one field is required" });

export type WorklogInput = z.infer<typeof worklogInputSchema>;
export type WorklogPatch = z.infer<typeof worklogPatchSchema>;