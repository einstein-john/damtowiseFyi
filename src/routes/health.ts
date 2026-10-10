import { Hono } from "hono";
import type { AppEnv } from "../types.js";

/**
 * Liveness only. Deliberately does not touch the database so a Neon outage is
 * reported by the API as up, and an orchestrator does not restart a healthy process.
 */
export function createHealthRoutes(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.get("/health", (c) =>
    c.json({ status: "ok", uptimeSeconds: Math.floor(process.uptime()) }),
  );

  return app;
}