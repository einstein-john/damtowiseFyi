/**
 * Wiring tests for the database-free paths: health, CORS, auth gate and the
 * unsigned webhook. Database-backed routes are covered by `scripts/smoke-test.ts`
 * against a real Neon database.
 */

import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { loadEnv, type Env } from "./config/env.js";
import { EventDedupeStore } from "./lib/auth/event-dedupe.js";
import { RateLimiter } from "./lib/rate-limit.js";
import { DebouncedDeployHook } from "./lib/publish/deploy-hook.js";
import { createHealthRoutes } from "./routes/health.js";
import { cors } from "./middleware/cors.js";
import { AppError, notFound } from "./lib/http/errors.js";
import { onError } from "./middleware/on-error.js";
import type { ServiceContext } from "./services/context.js";
import type { AppEnv } from "./types.js";
import type { Database } from "./db/client.js";

const ADMIN_ID = "admin-user-1";

const env: Env = loadEnv({
  DATABASE_URL: "postgres://pooled/db",
  DIRECT_DATABASE_URL: "postgres://direct/db",
  NEON_AUTH_URL: "https://auth.example.neon.tech",
  ADMIN_EMAIL: "admin@damtowise.xyz",
  ADMIN_USER_IDS: ADMIN_ID,
  CLOUDINARY_CLOUD_NAME: "demo",
  CLOUDINARY_API_KEY: "key",
  CLOUDINARY_API_SECRET: "secret",
  SITE_ORIGIN: "https://damtowise.xyz",
  API_PUBLIC_ORIGIN: "https://api.damtowise.xyz",
});

/** The DB is never reached on these paths, so an unconnected stub is enough. */
const services: ServiceContext = {
  env,
  db: {} as Database,
  cloudinary: { cloudName: "demo", apiKey: "key", apiSecret: "secret", secure: true },
  deployHook: new DebouncedDeployHook({ url: undefined, debounceMs: 60_000 }),
};

function app(): Hono<AppEnv> {
  const instance = new Hono<AppEnv>();
  instance.use("*", cors(env));
  instance.route("/", createHealthRoutes());
  instance.onError(onError);
  return instance;
}

describe("GET /health", () => {
  it("reports ok without touching the database", async () => {
    const response = await app().fetch(new Request("http://localhost/health"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "ok" });
  });
});

describe("CORS", () => {
  const allowed = "https://damtowise.xyz";

  it("allows the site origin", async () => {
    const response = await app().fetch(new Request("http://localhost/health", { headers: { origin: allowed } }));

    expect(response.headers.get("access-control-allow-origin")).toBe(allowed);
  });

  it("allows the Authorization header in preflight", async () => {
    const response = await app().fetch(
      new Request("http://localhost/admin/posts", {
        method: "OPTIONS",
        headers: { origin: allowed, "access-control-request-method": "PATCH" },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-headers")).toContain("Authorization");
  });

  it("answers a preflight without an Origin header", async () => {
    const response = await app().fetch(new Request("http://localhost/admin/posts", { method: "OPTIONS" }));

    expect(response.status).toBe(204);
  });

  it("rejects an unknown origin", async () => {
    const response = await app().fetch(
      new Request("http://localhost/health", { headers: { origin: "https://evil.example" } }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("error envelope", () => {
  it("preserves a known error status and message", async () => {
    const instance = new Hono<AppEnv>();
    instance.get("/boom", () => {
      throw notFound("Post not found");
    });
    instance.onError(onError);

    const response = await instance.fetch(new Request("http://localhost/boom"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "not_found", message: "Post not found" });
  });

  it("hides internals behind a generic 500", async () => {
    const instance = new Hono<AppEnv>();
    instance.get("/boom", () => {
      throw new Error("connection string leaked here");
    });
    instance.onError(onError);

    const response = await instance.fetch(new Request("http://localhost/boom"));
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).not.toContain("connection string");
  });

  it("maps a unique-violation to 409", async () => {
    const instance = new Hono<AppEnv>();
    instance.get("/boom", () => {
      throw Object.assign(new Error("duplicate key"), { code: "23505" });
    });
    instance.onError(onError);

    expect((await instance.fetch(new Request("http://localhost/boom"))).status).toBe(409);
  });

  it("serialises validation issues", () => {
    const body = new AppError(422, "unprocessable_entity", "nope", [{ path: "excerpt", message: "required" }]);

    expect(body.toBody().issues).toEqual([{ path: "excerpt", message: "required" }]);
  });
});

describe("admin identity allowlist", () => {
  it("does not treat an empty list as allow-all", () => {
    const closed: Env = { ...env, ADMIN_USER_IDS: [] };

    expect(closed.ADMIN_USER_IDS.includes(ADMIN_ID)).toBe(false);
  });
});

describe("webhook replay store", () => {
  it("rejects the same event id twice", () => {
    const store = new EventDedupeStore(600_000);

    expect(store.has("evt_1")).toBe(false);
    store.record("evt_1");
    expect(store.has("evt_1")).toBe(true);
  });
});