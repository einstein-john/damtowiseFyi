# AGENTS.md

Instructions for AI coding agents working in this repository. Read this before making
any change.

---

## What this project is

The HTTP API for a static writing site. Hono + TypeScript + Zod + Drizzle on Neon
Postgres, with Neon Auth, Cloudinary and a Vercel deploy hook.

**The Astro site is a separate repository.** Do not create site, template, pagefind or
sitemap code here. If a task needs changes on the site, say so and stop.

The API runs on a long-lived host because scheduled publishing and OG generation need
a persistent process, not a serverless invocation.

---

## Non-negotiable rules

1. **Respect the layering.** `routes` → `services` → `db/queries` + `lib`. Never
   import upward, and never sideways into a sibling route.
2. **`db/queries/` contains SQL only.** Rows in, rows out. No `c.json`, no HTTP types,
   no business decisions.
3. **`routes/`translate HTTP only.** Parse input, call one service, serialise output.
   If you are writing a conditional about *policy*, it belongs in a service.
4. **`contracts/` is the single source of truth for the wire.** Change a response
   shape there first, then update the seralizer and the route.
5. **One responsibility per module.** If a function does two things, split it. If a
   file exports two unrelated concepts, split it.
6. **No dead code.** No placeholder exports, no `void x` to silence unused imports,
   no commented-out blocks.
7. **No duplication.** If two files build the same URL or apply the same rule, the
   shared version goes in `contracts/` or `lib/`.
8. **Errors use the envelope.** `{ error, message?, issues? }` via `lib/http/errors.ts`.
   Never leak internals; unknown errors become a generic 500.
9. **Never weaken a security check to make a test pass.** Change the test or the
   design instead.
10. **Never add secret-bearing values to the frontend contracts.** Cloudinary API
    secret, `DATABASE_URL`, and the deploy hook URL are server-only.

---

## Where things live

| Change | File |
| --- | --- |
| New endpoint | `src/routes/…` for wiring, `src/services/…` for logic |
| Response shape | `src/contracts/` |
| Storage | `src/db/schema.ts`, then `npm run db:generate` |
| Auth logic | `src/lib/auth/` |
| Markdown / media rendering | `src/lib/markdown/`, `src/lib/media/` |
| Publish rules | `src/lib/publish/checks.ts` (pure) and `src/services/publish-service.ts` |
| Scheduling | `src/lib/scheduler/post-scheduler.ts` |
| Config | `src/config/env.ts` (Zod) — add the var, it is validated at boot |
| Row → wire | `src/serializers/` |

---

## Commands

```bash
npm install
npm run dev           # tsx watch
npm test              # vitest, no database or network
npm run typecheck     # full project, includes tests
npm run build         # tsconfig.build.json, excludes tests
npm run db:generate   # after editing src/db/schema.ts
```

There is no CI in this repo. Run `npm test && npm run typecheck && npm run build` yourself
before opening a PR. CodeRabbit (`.coderabbit.yaml`) reads this file as its guideline
list; if you change a rule here, change the matching `path_instructions` there too.

`scripts/smoke-test.ts` exercises the real routes but **needs a live database**. Do not
claim it passed unless it actually ran.

---

## Testing expectations

Pure logic is unit tested and must stay that way:

- Markdown rendering, sanitisation, TOC, read time → `src/lib/markdown/*.test.ts`
- Cloudinary URL construction, upload validation, magic bytes → `src/lib/media/`, `src/contracts/`
- Publish checks → `src/lib/publish/checks.test.ts`
- Webhook signature verification, sign-up gate → `src/lib/auth/*.test.ts`
- Rate limiter, deploy hook, scheduler → their own test files
- Query compilation → `src/db/queries/queries.test.ts` (in-memory pg-proxy driver)

Rules for new tests:

- **Inject dependencies** (`fetchImpl`, query functions). No network, no database.
- **Assert behaviour, not implementation.** "Rejects a second email" beats "calls function X".
- **Name the case, not the function.** `"rejects a payload with no timestamp"`.
- **Use fake timers** for anything time-dependent; do not sleep.

`src/db/queries/queries.test.ts` compiles SQL through a proxy driver, which is what
catches column-name typos. Keep new queries compilable there.

---

## Domain rules you must not break

- A post publishes **only** if every image, cover included, has alt text or is marked
  decorative. `collectPublishIssues` is the single implementation.
- Post bodies reference media as `media:<uuid>`; `collectMediaRefs` is the single
  parser and it ignores fenced code.
- Media is deletable **only** when nothing references it — cover, body, or worklog.
- A slug change must insert a `slug_redirects` row and delete the old OG asset at
  `og/fyi/<old-slug>`.
- Publish triggers the deploy hook **debounced**. Never fire it directly; that burns
  Vercel build minutes.
- `GET /health` must never query the database.
- Scheduled publishing must not poll. One timer, re-armed.
- Signs of a correctly deployed system: public reads have an ETag, admin reads have
  `no-store`.

---

## Code style

- TypeScript `strict`, `NodeNext` ESM with explicit `.js` import specifiers.
- Zod for every inbound payload and query string, via `zValidator` in routes.
- Prefer explicit types over inference at module boundaries.
- Comments explain **why**, never **what**. Delete the rest.
- Named exports only; no default exports.
- `async`/`await`, never `.then()` chains.
- Booleans are `Boolean`, not truthy strings. Config parses them through Zod.
- No `any`. If you need an escape hatch for an untyped SDK, isolate it behind a
  module boundary and name the type.

---

## Things that are easy to get wrong

- **`compactVerify` is not `jwtVerify`.** Webhook signature verification uses
  `compactVerify` with a resolver; also confirm the decoded payload matches the raw
  body bytes.
- **The OG public id already contains its folder.** Do not pass `folder` *and* a
  qualified `public_id` to Cloudinary; the path gets doubled.
- **`updatedAt` is not automatic.** `db/queries/posts.ts` sets it on every update.
  Do not rely on a database trigger.
- **Optional env vars may be blank** in `.env` files. `blankAsUndefined` converts
  `""` to `undefined` so optional values validate.
- **`ADMIN_USER_IDS` empty means allow nobody.** Never interpret an empty allowlist
  as "everyone".
- **Slug uniqueness is guaranteed at write time** by a unique index. Do not re-check
  it in the publish path; the check would be dead code.

---

## When a task is ambiguous

Ask rather than guess, especially for:

- Anything touching auth or the sign-up gate.
- Anything that would add a dependency.
- Anything that changes the database schema (a migration has consequences).
- Anything that makes a public route write, or an admin route public.
- Anything that would poll the database on a timer.

---

## Where reviewers look

`.coderabbit.yaml` restates the rules above per directory, so CodeRabbit flags the
same things a human would. If you add a rule here, add a `path_instructions` entry
there.
