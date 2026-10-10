import { z } from "zod";

export const uuid = z.string().uuid();

export const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be a lowercase, hyphen-separated slug");

/** Accepts `2026-01-31T09:00:00Z` and `2026-01-31T09:00:00+02:00`. */
export const isoDateTime = z.string().datetime({ offset: true });

export const idParamSchema = z.object({ id: uuid });