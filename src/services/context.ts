import type { Env } from "../config/env.js";
import type { Database } from "../db/client.js";
import type { CloudinaryClientConfig } from "../lib/media/cloudinary.js";
import type { DebouncedDeployHook } from "../lib/publish/deploy-hook.js";

/** Everything the services need, wired once at boot and passed explicitly. */
export interface ServiceContext {
  env: Env;
  db: Database;
  cloudinary: CloudinaryClientConfig;
  deployHook: DebouncedDeployHook;
}