import { createRemoteJWKSet, type JWSHeaderParameters, type FlattenedJWSInput, type KeyLike, type JWTPayload } from "jose";
import type { Env } from "../../config/env.js";

/**
 * Structurally typed so the same resolver serves both `jwtVerify` and
 * `compactVerify` without casting between jose's two get-key aliases.
 */
export type JwksResolver = (
  protectedHeader?: JWSHeaderParameters,
  token?: FlattenedJWSInput,
) => Promise<KeyLike>;

export interface NeonAuthKeys {
  /** Verification keys for access tokens and webhook signatures. */
  resolveKey: JwksResolver;
}

export function jwksUrl(env: Env): URL {
  return new URL("/.well-known/jwks.json", `${env.NEON_AUTH_URL.replace(/\/+$/, "")}/`);
}

/** jose caches the document internally and refetches only on an unknown `kid`. */
export function createNeonAuthKeys(env: Env): NeonAuthKeys {
  return { resolveKey: createRemoteJWKSet(jwksUrl(env)) };
}

export function readStringClaim(payload: JWTPayload, claim: string): string | null {
  const value = payload[claim];
  return typeof value === "string" ? value : null;
}