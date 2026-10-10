import type { Context } from "hono";

/** Left-most `X-Forwarded-For` entry, since Caddy/Traefik only appends. */
export function clientIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return c.req.header("cf-connecting-ip") ?? c.req.header("x-real-ip") ?? "unknown";
}