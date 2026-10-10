import type { Context, Next } from "hono";
import { tooManyRequests } from "../lib/http/errors.js";
import { clientIp } from "../lib/http/client-ip.js";
import type { RateLimiter } from "../lib/rate-limit.js";

export interface RateLimitOptions {
  limiter: RateLimiter;
  /** Distinguishes buckets so a write flood cannot consume the webhook budget. */
  bucket: string;
  /** Defaults to the client address. */
  keyFor?: (c: Context) => string;
}

/** Fixed-window limit keyed by client address (or a caller-supplied identity). */
export function rateLimit(options: RateLimitOptions) {
  return async function rateLimitMiddleware(c: Context, next: Next): Promise<void> {
    const identity = options.keyFor?.(c) ?? clientIp(c);
    const decision = options.limiter.consume(`${options.bucket}:${identity}`);

    c.header("X-RateLimit-Limit", String(decision.limit));
    c.header("X-RateLimit-Remaining", String(decision.remaining));
    c.header("X-RateLimit-Reset", String(Math.ceil(decision.resetAt / 1000)));

    if (!decision.allowed) {
      c.header("Retry-After", String(Math.max(1, Math.ceil((decision.resetAt - Date.now()) / 1000))));
      throw tooManyRequests("Rate limit exceeded");
    }

    await next();
  };
}