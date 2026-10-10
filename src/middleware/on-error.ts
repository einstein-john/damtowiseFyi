import { toErrorResponse } from "../lib/http/errors.js";
import type { AppEnv } from "../types.js";

/**
 * Single exit point for failures: known errors keep their status and message,
 * everything else is logged and reported as a generic 500.
 */
export function onError(error: Error, c: import("hono").Context<AppEnv>): Response {
  return toErrorResponse(c, error);
}