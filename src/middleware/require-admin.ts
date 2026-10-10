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

    const issuer = jwtIssuer(env);

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

/**
 * Neon signs access tokens with `iss` set to the **origin** of the auth URL
 * (`https://<project>.auth.neon.tech`), not to the full base URL that may carry
 * a path such as `/neondb/auth`. jose compares the claim with a plain string
 * equality, so trusting `NEON_AUTH_URL` verbatim would 401 every real token.
 * `NEON_AUTH_JWT_ISSUER` still wins for hosts with a non-default issuer.
 */
function jwtIssuer(env: Env): string {
  if (env.NEON_AUTH_JWT_ISSUER) return env.NEON_AUTH_JWT_ISSUER;
  try {
    return new URL(env.NEON_AUTH_URL).origin;
  } catch {
    // The env schema already rejects anything that is not a URL; this only
    // guards the impossible, and keeps the failure legible if that ever changes.
    return env.NEON_AUTH_URL;
  }
}