import { z } from "zod";

const booleanish = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const csv = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );

/** A blank value in a `.env` file means "not configured", not "invalid". */
const blankAsUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), schema);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),

  /** Pooled Neon connection string used by the running app. */
  DATABASE_URL: z.string().min(1),
  /** Direct (non-pooled) connection string, used only by drizzle-kit. */
  DIRECT_DATABASE_URL: z.string().min(1),

  NEON_AUTH_URL: z.string().url(),
  /** Defaults to NEON_AUTH_URL; override if your tokens carry a different issuer. */
  NEON_AUTH_JWT_ISSUER: blankAsUndefined(z.string().url().optional()),
  /** Leave unset when the tokens have no audience claim. */
  NEON_AUTH_JWT_AUDIENCE: blankAsUndefined(z.string().optional()),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_USER_IDS: csv,
  ALLOW_SIGNUP: booleanish.default("false"),

  SITE_ORIGIN: z.string().url().default("https://damtowise.xyz"),
  API_PUBLIC_ORIGIN: z.string().url().default("https://api.damtowise.xyz"),

  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
  CLOUDINARY_FOLDER: z.string().min(1).default("fyi"),

  VERCEL_DEPLOY_HOOK_URL: blankAsUndefined(z.string().url().optional()),

  /** Deploy-hook coalescing window; each flush spends one Vercel build minute. */
  DEPLOY_DEBOUNCE_MS: z.coerce.number().int().min(0).default(60_000),

  /** Rejects replayed webhook deliveries older than this. */
  WEBHOOK_SIGNATURE_MAX_AGE_SECONDS: z.coerce.number().int().min(30).default(300),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1_000).default(60_000),
  /** Requests per window per client address, per bucket. */
  ADMIN_READ_RATE_LIMIT: z.coerce.number().int().min(1).default(120),
  ADMIN_WRITE_RATE_LIMIT: z.coerce.number().int().min(1).default(20),
  WEBHOOK_RATE_LIMIT: z.coerce.number().int().min(1).default(10),

  SCHEDULER_ENABLED: booleanish.default("true"),

  /** Directory holding the TTF files bundled for OG image rendering. */
  OG_FONTS_DIR: z.string().default("assets/fonts"),
});

export type Env = z.infer<typeof envSchema>;

/** Parses the environment once at boot; throws with an actionable message. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (parsed.success) return parsed.data;

  const problems = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${problems}`);
}

export function isAdminUser(env: Env, userId: string | undefined): boolean {
  return typeof userId === "string" && env.ADMIN_USER_IDS.includes(userId);
}