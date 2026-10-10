import type { Context } from "hono";
import type { ApiErrorBody } from "../../contracts/index.js";

type HttpStatus = 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 429 | 500 | 502 | 503;

/** Errors that are safe to describe to a client. Anything else becomes a 500. */
export class AppError extends Error {
  readonly status: HttpStatus;
  readonly code: string;
  readonly issues: ApiErrorBody["issues"];

  constructor(status: HttpStatus, code: string, message: string, issues?: ApiErrorBody["issues"]) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.issues = issues;
  }

  toBody(): ApiErrorBody {
    return { error: this.code, message: this.message, ...(this.issues ? { issues: this.issues } : {}) };
  }
}

export const badRequest = (message: string, issues?: ApiErrorBody["issues"]) =>
  new AppError(400, "bad_request", message, issues);

export const unauthorized = (message = "Missing or invalid credentials") =>
  new AppError(401, "unauthorized", message);

export const forbidden = (message = "Not permitted") => new AppError(403, "forbidden", message);

export const notFound = (message = "Not found") => new AppError(404, "not_found", message);

export const conflict = (message: string) => new AppError(409, "conflict", message);

export const payloadTooLarge = (message: string) => new AppError(413, "payload_too_large", message);

export const unsupportedMediaType = (message: string) =>
  new AppError(415, "unsupported_media_type", message);

export const unprocessable = (message: string, issues?: ApiErrorBody["issues"]) =>
  new AppError(422, "unprocessable_entity", message, issues);

export const tooManyRequests = (message = "Too many requests") =>
  new AppError(429, "too_many_requests", message);

/** Serialises any thrown value into the single response envelope every route uses. */
export function toErrorResponse(c: Context, error: unknown): Response {
  if (error instanceof AppError) {
    return c.json(error.toBody(), error.status);
  }

  const pgCode = (error as { code?: string } | null)?.code;
  if (pgCode === "23505") {
    return c.json({ error: "conflict", message: "That value is already taken" }, 409);
  }
  if (pgCode === "23503") {
    return c.json({ error: "bad_request", message: "Referenced record does not exist" }, 400);
  }

  console.error("[api] unhandled error", error);
  return c.json({ error: "internal_error", message: "Unexpected server error" }, 500);
}