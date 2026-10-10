#!/usr/bin/env node
/**
 * Fails fast when the wrong package manager installs this project.
 *
 * `npm i` in a pnpm project aborts with
 *
 *   npm error code EUNSUPPORTEDPROTOCOL
 *   npm error Unsupported URL Type "workspace:": workspace:./drizzle-orm/dist
 *
 * because `drizzle-kit` publishes a manifest whose devDependencies still carry a
 * pnpm-workspace specifier. There is nothing to fix on our side: pnpm resolves
 * it normally. This script turns that cryptic failure into an actionable one.
 */

const EXPECTED = "pnpm@9.15.9";

const userAgent = process.env.npm_config_user_agent ?? "";

// pnpm and yarn set this too; only npm needs the intervention.
if (userAgent.startsWith("npm/")) {
  console.error(
    [
      "",
      `  This project is managed with ${EXPECTED}.`,
      "",
      `  Run:   pnpm install`,
      "",
      "  Why npm fails here:",
      "    drizzle-kit publishes a manifest that contains",
      '      "drizzle-orm": "workspace:./drizzle-orm/dist"',
      "    inside devDependencies. npm cannot parse the workspace: protocol",
      "    (an internal pnpm-monorepo leftover), so it aborts mid-install.",
      "    pnpm resolves the dependency normally, so the project itself is fine.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}
