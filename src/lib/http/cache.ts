import type { Context } from "hono";
import { computeEtag, etagMatches } from "./etag.js";

/**
 * Public reads are only ever fetched by the Astro build, but they stay cacheable so a
 * rebuild (or a future non-static consumer) gets cheap revalidation.
 */
export const PUBLIC_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=600";

export function publicCacheControl(): string {
  return PUBLIC_CACHE_CONTROL;
}

/** Admin responses are per-user and must never be stored by a shared cache. */
export const PRIVATE_CACHE_CONTROL = "no-store";

/** JSON response for authenticated routes; always uncacheable. */
export function privateJson(c: Context, payload: unknown, status: 200 | 201 = 200): Response {
  return c.json(payload, status, { "Cache-Control": PRIVATE_CACHE_CONTROL });
}

export interface CacheableJsonOptions {
  cacheControl: string;
}

/** Sends JSON with an ETag, collapsing conditional requests into a 304. */
export function cacheableJson(c: Context, payload: unknown, options: CacheableJsonOptions): Response {
  const etag = computeEtag(payload);
  const headers: Record<string, string> = {
    ETag: etag,
    "Cache-Control": options.cacheControl,
  };

  if (etagMatches(c.req.header("if-none-match"), etag)) {
    return new Response(null, { status: 304, headers });
  }

  return c.json(payload, 200, headers);
}