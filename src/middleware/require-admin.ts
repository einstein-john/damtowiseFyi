import { jwtVerify } from "jose";
import { isAdminUser, type Env } from "../config/env.js";
import { createNeonAuthKeys, readStringClaim, type NeonAuthKeys } from "../lib/auth/keys.js";
import type { AppMiddleware } from "../types.js";

/** Cached per process; `createRemoteJWKSet` handles the HTTP caching itself. */
let cachedKeys: NeonAuthKeys | null = null;

export function authKeys(env: Env): NeonAuthKeys {
  cachedKeys ??= createNeonAuthKeys(env);
  return cachedKeys;
}

/** Discards the cached JWKS resolver; used when the auth host changes. */
export function resetAuthKeys(): void {
  cachedKeys = null;
}

/**
 * Guards every admin route: a valid Neon Auth JWT whose `sub` is on the
 * allowlist. Anything short of that is a 401 or 403 — never a partial pass.
 */
export function requireAdmin(env: Env): AppMiddleware {
  return async (c, next) => {
    const token = c.req.header("authorization")?.replace(/^Bearer /, "").trim();

    if (!token) {
      return c.json({ error: "unauthorized", message: "Missing bearer token" }, 401);
    }

    const issuer = env.NEON_AUTH_JWT_ISSUER ?? env.NEON_AUTH_URL;

    let payload;
    try {
      ({ payload } = await jwtVerify(token, authKeys(env).resolveKey, {
        issuer,
        ...(env.NEON_AUTH_JWT_AUDIENCE ? { audience: env.NEON_AUTH_JWT_AUDIENCE } : {}),
      }));
    } catch {
      return c.json({ error: "unauthorized", message: "Invalid or expired token" }, 401);
    }

    const userId = readStringClaim(payload, "sub");
    if (!userId || !isAdminUser(env, userId)) {
      return c.json({ error: "forbidden", message: "Not an administrator" }, 403);
    }

    c.set("admin", { userId, email: readStringClaim(payload, "email") });
    await next();
  };
}