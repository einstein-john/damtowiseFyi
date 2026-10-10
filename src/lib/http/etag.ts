import { createHash } from "node:crypto";

/** Strong ETag over the exact serialised body, so byte-identical payloads collide. */
export function computeEtag(payload: unknown): string {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  return `"${createHash("sha256").update(body).digest("base64url")}"`;
}

export function etagMatches(ifNoneMatch: string | undefined, etag: string): boolean {
  if (!ifNoneMatch) return false;
  if (ifNoneMatch.trim() === "*") return true;
  return ifNoneMatch
    .split(",")
    .map((candidate) => candidate.trim())
    .some((candidate) => candidate === etag || candidate === `W/${etag}`);
}