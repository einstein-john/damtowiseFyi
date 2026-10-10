import type { Context, MiddlewareHandler } from "hono";
import type { AdminIdentity } from "./contracts/index.js";
import type { Env } from "./config/env.js";
import type { ServiceContext } from "./services/context.js";

/** Context variables every route may rely on. */
export interface AppVariables {
  /** Shared services: env, database, Cloudinary, deploy hook. */
  services: ServiceContext;
  /** Populated by `requireAdmin`; never present on public routes. */
  admin: AdminIdentity;
}

export type AppEnv = {
  Variables: AppVariables;
};

export type AppContext = Context<AppEnv>;
export type AppMiddleware = MiddlewareHandler<AppEnv>;