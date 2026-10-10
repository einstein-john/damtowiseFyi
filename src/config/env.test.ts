import { describe, expect, it } from "vitest";
import { isAdminUser, loadEnv } from "./env.js";

const base: NodeJS.ProcessEnv = {
  DATABASE_URL: "postgres://pooled/db",
  DIRECT_DATABASE_URL: "postgres://direct/db",
  NEON_AUTH_URL: "https://auth.example.neon.tech",
  ADMIN_EMAIL: "admin@damtowise.xyz",
  ADMIN_USER_IDS: "user-1,user-2",
  CLOUDINARY_CLOUD_NAME: "demo",
  CLOUDINARY_API_KEY: "key",
  CLOUDINARY_API_SECRET: "secret",
};

describe("loadEnv", () => {
  it("applies documented defaults", () => {
    const env = loadEnv(base);

    expect(env.PORT).toBe(8787);
    expect(env.ALLOW_SIGNUP).toBe(false);
    expect(env.CLOUDINARY_FOLDER).toBe("fyi");
    expect(env.DEPLOY_DEBOUNCE_MS).toBe(60_000);
    expect(env.SCHEDULER_ENABLED).toBe(true);
  });

  it("parses the admin id list", () => {
    expect(loadEnv(base).ADMIN_USER_IDS).toEqual(["user-1", "user-2"]);
  });

  it("ignores whitespace in the id list", () => {
    expect(loadEnv({ ...base, ADMIN_USER_IDS: " user-1 , , user-2 " }).ADMIN_USER_IDS).toEqual([
      "user-1",
      "user-2",
    ]);
  });

  it("parses boolean-ish flags", () => {
    expect(loadEnv({ ...base, ALLOW_SIGNUP: "true" }).ALLOW_SIGNUP).toBe(true);
    expect(loadEnv({ ...base, SCHEDULER_ENABLED: "false" }).SCHEDULER_ENABLED).toBe(false);
  });

  it("coerces numeric values", () => {
    expect(loadEnv({ ...base, PORT: "3000" }).PORT).toBe(3000);
  });

  it("leaves the deploy hook undefined when unset", () => {
    expect(loadEnv(base).VERCEL_DEPLOY_HOOK_URL).toBeUndefined();
  });

  it("names every missing variable at once", () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL[\s\S]*CLOUDINARY_API_SECRET/);
  });

  it("rejects an unparseable boolean", () => {
    expect(() => loadEnv({ ...base, ALLOW_SIGNUP: "yes" })).toThrow(/ALLOW_SIGNUP/);
  });

  it("rejects a malformed url", () => {
    expect(() => loadEnv({ ...base, NEON_AUTH_URL: "not-a-url" })).toThrow(/NEON_AUTH_URL/);
  });
});

describe("isAdminUser", () => {
  const env = loadEnv(base);

  it("allows a listed id", () => {
    expect(isAdminUser(env, "user-2")).toBe(true);
  });

  it("rejects an unlisted id", () => {
    expect(isAdminUser(env, "user-3")).toBe(false);
  });

  it("rejects a missing id", () => {
    expect(isAdminUser(env, undefined)).toBe(false);
  });
});