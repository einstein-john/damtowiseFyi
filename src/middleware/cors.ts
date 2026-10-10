import { Hono } from "hono";
import type { Env } from "../config/env.js";
import { cloudinaryDeliveryOrigin } from "../contracts/index.js";
import type { AppMiddleware } from "../types.js";

const ALLOWED_METHODS = ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"];

const ALLOWED_REQUEST_HEADERS = [
  "Authorization",
  "Content-Type",
  "X-Neon-Signature",
  "X-Neon-Event-Id",
  "X-Neon-Signature-Kid",
];

function originMatches(origin: string, expected: string): boolean {
  return origin === expected.replace(/\/+$/, "");
}

/**
 * Bearer-token API: no cookies, so `credentials` is never needed and preflight
 * only has to allow the `Authorization` header.
 */
export function cors(env: Env): AppMiddleware {
  return async (c, next) => {
    const origin = c.req.header("origin");
    const allowed = origin !== undefined && isAllowedOrigin(origin, env);

    if (origin !== undefined && !allowed) {
      return c.json({ error: "forbidden", message: "Origin is not allowed" }, 403);
    }

    if (allowed && origin !== undefined) {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Vary", "Origin");
      c.header("Access-Control-Allow-Methods", ALLOWED_METHODS.join(", "));
      c.header("Access-Control-Allow-Headers", ALLOWED_REQUEST_HEADERS.join(", "));
      c.header("Access-Control-Max-Age", "600");
    }

    if (c.req.method === "OPTIONS") return c.body(null, 204);

    await next();
  };
}

function isAllowedOrigin(origin: string, env: Env): boolean {
  return originMatches(origin, env.SITE_ORIGIN) || originMatches(origin, env.API_PUBLIC_ORIGIN);
}

/**
 * Baseline response hardening. The `/admin` UI is served by Astro, so this is a
 * backstop rather than the only line of defence.
 */
export function securityHeaders(env: Env): AppMiddleware {
  return async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header(
      "Content-Security-Policy",
      [
        "default-src 'none'",
        `img-src ${cloudinaryDeliveryOrigin(env.CLOUDINARY_CLOUD_NAME)} data:`,
        "frame-ancestors 'none'",
        "base-uri 'none'",
      ].join("; "),
    );
  };
}