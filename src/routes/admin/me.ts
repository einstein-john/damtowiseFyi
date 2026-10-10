import { Hono } from "hono";
import type { AdminIdentity } from "../../contracts/index.js";
import type { AppEnv } from "../../types.js";

/** Lets the admin UI confirm which identity its token actually resolves to. */
export function createMeRoutes(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.get("/me", (c) => {
    const admin: AdminIdentity = c.get("admin");
    return c.json(admin, 200, { "Cache-Control": "no-store" });
  });

  return app;
}