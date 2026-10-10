/**
 * Boots the app against the configured database and exercises every read path
 * plus the unauthenticated admin/webhook paths.
 *
 *   npx tsx --env-file=.env scripts/smoke-test.ts
 */

import { loadEnv } from "../src/config/env.js";
import { createApp } from "../src/app.js";
import { createDatabase } from "../src/db/client.js";
import { configureCloudinary } from "../src/lib/media/cloudinary.js";
import { DebouncedDeployHook } from "../src/lib/publish/deploy-hook.js";
import { RateLimiter } from "../src/lib/rate-limit.js";
import type { ServiceContext } from "../src/services/context.js";

const env = loadEnv();
const { db, pool } = createDatabase(env.DATABASE_URL);

const services: ServiceContext = {
  env,
  db,
  cloudinary: configureCloudinary(env),
  deployHook: new DebouncedDeployHook({ url: undefined, debounceMs: env.DEPLOY_DEBOUNCE_MS }),
};

const app = createApp({
  env,
  services,
  limiters: {
    adminRead: new RateLimiter(10_000, env.RATE_LIMIT_WINDOW_MS),
    adminWrite: new RateLimiter(10_000, env.RATE_LIMIT_WINDOW_MS),
    webhook: new RateLimiter(10_000, env.RATE_LIMIT_WINDOW_MS),
  },
});

interface Check {
  name: string;
  path: string;
  init?: RequestInit;
  /** 401 is a pass for routes that require a token we do not have here. */
  expect: number[];
}

const CHECKS: Check[] = [
  { name: "GET /health", path: "/health", expect: [200] },
  { name: "GET /posts", path: "/posts", expect: [200] },
  { name: "GET /posts/:slug (missing)", path: "/posts/does-not-exist", expect: [404] },
  { name: "GET /posts/:slug (bad slug)", path: "/posts/Not%20A%20Slug", expect: [400] },
  { name: "GET /tags", path: "/tags", expect: [200] },
  { name: "GET /worklog", path: "/worklog", expect: [200] },
  { name: "GET /redirects", path: "/redirects", expect: [200] },
  { name: "GET /admin/me (no token)", path: "/admin/me", expect: [401] },
  { name: "GET /admin/posts (no token)", path: "/admin/posts", expect: [401] },
  { name: "GET /admin/tags (no token)", path: "/admin/tags", expect: [401] },
  { name: "GET /admin/media (no token)", path: "/admin/media", expect: [401] },
  { name: "GET /admin/worklog (no token)", path: "/admin/worklog", expect: [401] },
  { name: "POST /admin/posts (no token)", path: "/admin/posts", expect: [401] },
  { name: "POST /webhooks/neon-auth (unsigned)", path: "/webhooks/neon-auth", expect: [401] },
];

let failures = 0;

for (const check of CHECKS) {
  const response = await app.fetch(new Request(`http://localhost${check.path}`, check.init));
  const passed = check.expect.includes(response.status);

  if (!passed) {
    failures += 1;
    console.log(`FAIL  ${check.name.padEnd(38)} ${response.status} (expected ${check.expect.join("/")})`);
    console.log(`      ${(await response.text()).slice(0, 300)}`);
  } else {
    console.log(`PASS  ${check.name.padEnd(38)} ${response.status}`);
  }
}

const cacheHeaders = app.fetch(new Request("http://localhost/posts"));
const etag = (await cacheHeaders).headers.get("etag");

if (etag) {
  const revalidated = await app.fetch(new Request("http://localhost/posts", { headers: { "if-none-match": etag } }));
  console.log(`${revalidated.status === 304 ? "PASS" : "FAIL"}  ETag revalidation returns 304${revalidated.status === 304 ? "" : ` (got ${revalidated.status})`}`);
  if (revalidated.status !== 304) failures += 1;
}

await pool.end();

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);