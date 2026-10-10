<div align="center">

# damtowise&nbsp;FYI

### The API behind a static writing site

Hono · TypeScript · Zod · Drizzle · Neon Postgres · Neon Auth · Cloudinary

<br/>

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Runtime](https://img.shields.io/badge/Node-20%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Framework](https://img.shields.io/badge/Hono-4.x-E36002?style=flat-square&logo=hono&logoColor=white)](https://hono.dev/)
[![Tests](https://img.shields.io/badge/tests-164%20passing-brightgreen?style=flat-square)](./)
[![License](https://img.shields.io/badge/license-private-lightgrey?style=flat-square)](#)

<br/>

```
   Astro site (static, separate repo)
            │
            │  build-time GET    admin UI writes
            ▼                    + Bearer JWT
   ┌─────────────────────────────────────────┐
   │  api.damtowise.xyz                      │
   │  ┌────────┐  ┌────────────┐  ┌────────┐ │
   │  │ /fyi   │  │  /admin/*  │  │/webhook│ │
   │  └────────┘  └────────────┘  └────────┘ │
   └─────────────────────────────────────────┘
            │            │              │
      ┌─────┴────┐  ┌─────┴────┐   ┌─────┴─────┐
      │  Neon    │  │Cloudinary│   │  Vercel   │
      │ Postgres │  │  images  │   │deploy hook│
      │+Neon Auth│  │  + OG    │   └───────────┘
      └──────────┘  └──────────┘
```

</div>

---

## Why this repo exists

The Astro portfolio and `/fyi` writing site are **static** and live in a separate
project. This repo is the API they build from and write to.

Public traffic never reaches this service. The site renders at build time from
`GET /posts`, `/worklog`, `/tags` and `/redirects`; the `/admin` UI is the only thing
that talks to it in a browser.

It runs on a small always-on host (Fly.io, Railway, or a VPS) for exactly two
reasons: **scheduled publishing** and **OG image generation**. Both need a
long-running process, which is why we don't run it on Vercel.

---

## Install

> [!IMPORTANT]
> This project uses **pnpm**, not npm. See [Why npm fails](#why-npm-fails).

```bash
pnpm install
cp .env.example .env          # then fill in the values
pnpm db:generate              # SQL from src/db/schema.ts
pnpm db:migrate               # apply it (uses DIRECT_DATABASE_URL)
pnpm dev                      # http://localhost:8787
```

Check your setup before anything else:

```bash
npx tsx --env-file=.env scripts/check-env.ts     # config only
npx tsx --env-file=.env scripts/smoke-test.ts   # routes, needs a live database
pnpm test                                          # 164 tests, no database needed
```

---

## Layering

One direction only: **`routes` → `services` → `db/queries` + `lib`**. Nothing ever
imports upward.

```
routes/       HTTP translation only. Parse, call a service, serialise.
  ↓
services/     Every decision lives here. This is the only layer routes call.
  ↓
db/queries/   SQL only. Return rows. No business rules, no HTTP types.
lib/          Pure functions: markdown, uploads, signatures, OG, scheduler.

serializers/  Row → wire shape. contracts/ is the single definition of the wire.
```

| I want to… | Go to |
| --- | --- |
| Add or change an endpoint | `src/routes/` (wiring) + `src/services/` (logic) |
| Change what a response looks like | `src/contracts/` — one file, both ends |
| Change how something is stored | `src/db/schema.ts`, then `pnpm db:generate` |
| Change Markdown or media rendering | `src/lib/markdown/`, `src/lib/media/` |
| Change an auth rule | `src/lib/auth/` — never inline in a route |

**The rule that holds it together:** a service never formats JSON and a route never
writes SQL. If you find `c.json` below `src/services/`, that's a bug.

---

## Authentication

Neon Auth, with two independent gates because Neon Auth allows open sign-up.

<div align="center">

```
┌──────────────────────────┐        ┌──────────────────────────┐
│  Gate 1 · sign-up webhook │        │  Gate 2 · every /admin/* │
│  user.before_create       │        │  requireAdmin            │
│                           │        │                          │
│  verify Ed25519 signature │        │  verify JWT against JWKS │
│  → check kid             │        │  → check sub against     │
│  → check timestamp (±5m) │        │    ADMIN_USER_IDS        │
│  → dedupe event id        │        │                          │
│  → allow ADMIN_EMAIL only │        │  403 for a valid token   │
│                           │        │  that isn't allowlisted  │
│  { allowed: false } = 403 │        │                          │
└──────────────────────────┘        └──────────────────────────┘
```

</div>

### Bootstrapping the admin account

```bash
# 1. Open the gate for exactly one address
ALLOW_SIGNUP=true

# 2. Sign up once from the admin UI

# 3. Copy your id into the allowlist
SELECT id, email FROM neon_auth.user;
ADMIN_USER_IDS=<that id>

# 4. Close it immediately
ALLOW_SIGNUP=false
```

> [!WARNING]
> Test both gates before you depend on them: sign up with a **second email** and
> confirm the webhook rejects it, and send a valid JWT whose `sub` is *not* in
> `ADMIN_USER_IDS` and confirm you get a **403**.

The signature check compares the decoded JWS payload to the raw request body, so a
re-serialised body cannot pass. That check lives in
`src/lib/auth/verify-webhook-signature.ts`.

---

## Endpoints

### Public — read-only, cached

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/health` | **Never** touches the database |
| `GET` | `/posts` | `?tag=&page=&pageSize=`, published only |
| `GET` | `/posts/:slug` | 404 for anything unpublished |
| `GET` | `/tags` | |
| `GET` | `/worklog` | Published items only |
| `GET` | `/redirects` | Consumed by the site build |

Every public read carries `Cache-Control: public, s-maxage=60, stale-while-revalidate=600`
and a strong `ETag`. A matching `If-None-Match` returns `304`.

### Admin — Bearer token + `requireAdmin`

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/admin/me` | The verified `sub` and `email` |
| `GET` `POST` | `/admin/posts` | Markdown rendered on save |
| `GET` `PATCH` `DELETE` | `/admin/posts/:id` | Slug change writes a redirect row |
| `POST` | `/admin/posts/:id/publish` | Checks → OG → status → deploy hook |
| `POST` | `/admin/posts/:id/unpublish` | Back to draft, content and OG kept |
| `GET` | `/admin/posts/:id/publish-readiness` | Reports blockers, changes nothing |
| `GET` `POST` | `/admin/media` | Multipart: validate → Cloudinary |
| `PATCH` `DELETE` | `/admin/media/:id` | Delete blocked while referenced |
| `GET` `POST` `PATCH` `DELETE` | `/admin/tags` | `post_tags` cascades |
| `GET` `POST` `PATCH` `DELETE` | `/admin/worklog` | |
| `POST` | `/admin/worklog/reorder` | Bulk reorder for the drag-and-drop list |

Errors are always `{ error, message?, issues? }`. Known failures keep their status;
everything else is a generic `500` and is logged server-side only.

---

## Publish pipeline

```
POST /admin/posts/:id/publish
        │
   ┌────▼──────────────────────────────────────────────────────┐
   │ 1 · pre-publish checks           checks.ts (pure)          │
   │     alt text on every image      excerpt · SEO · slug      │
   ├────────────────────────────────────────────────────────────┤
   │ 2 · render markdown              lib/markdown/             │
   │     stores content_html, toc, read_time                    │
   ├────────────────────────────────────────────────────────────┤
   │ 3 · generate OG image            lib/og/                   │
   │     satori + resvg, 1200×630, JetBrains Mono bundled       │
   │     → Cloudinary at og/fyi/<slug>, overwrite + invalidate  │
   ├────────────────────────────────────────────────────────────┤
   │ 4 · status = published, published_at = now                 │
   ├────────────────────────────────────────────────────────────┤
   │ 5 · trigger Vercel deploy hook, debounced 60s               │
   └────────────────────────────────────────────────────────────┘
```

Every step is separately testable — `checks.ts` is a pure function, the deploy hook
takes an injected `fetchImpl`, and the scheduler takes injected query functions.

Scheduled posts use **one in-memory timer** aimed at the next `published_at`. No
polling: a per-minute query would burn the free Neon CU-hour budget. Re-armed on
startup and after every fire.

---

## Content and media

Post bodies reference uploads as `![alt](media:<uuid>)`. The renderer resolves each
one and emits a real `<figure>` with a Cloudinary `srcset`:

```html
<figure class="article-figure">
  <img src="…" srcset="… 480w, … 800w, … 1200w" sizes="…"
       width="2400" height="1600" loading="lazy" decoding="async" alt="…">
  <figcaption>Caption</figcaption>
</figure>
```

Publishing is **blocked** if any image — cover included — lacks alt text and isn't
marked decorative. Uploads are gated on declared type, magic bytes, and size before
Cloudinary is ever contacted.

> [!TIP]
> Turn on **strict transformations** in the Cloudinary console. Without it, a crafted
> URL generated from your public cloud name can burn credits.

---

## Configuration

| Group | Variables |
| --- | --- |
| Runtime | `NODE_ENV` `PORT` |
| Neon | `DATABASE_URL` (pooled) `DIRECT_DATABASE_URL` (direct) |
| Neon Auth | `NEON_AUTH_URL` `ADMIN_EMAIL` `ADMIN_USER_IDS` `ALLOW_SIGNUP` |
| Origins | `SITE_ORIGIN` `API_PUBLIC_ORIGIN` |
| Cloudinary | `CLOUDINARY_CLOUD_NAME` `CLOUDINARY_API_KEY` `CLOUDINARY_API_SECRET` `CLOUDINARY_FOLDER` |
| Vercel | `VERCEL_DEPLOY_HOOK_URL` |
| Tuning | `DEPLOY_DEBOUNCE_MS` `*_RATE_LIMIT` `WEBHOOK_SIGNATURE_MAX_AGE_SECONDS` `SCHEDULER_ENABLED` |

Full list with defaults in [`.env.example`](./.env.example).

**Neon rules that matter:** pooled string for the app (`max 5`, 10s idle timeout),
direct string for migrations only. `sslmode=require`, same region as the host. A
dropped connection after a cold start is retried once. Nightly `pg_dump` outside Neon,
because the free restore window is short — and a full dump covers `neon_auth` too.

---

## Deployment

```bash
docker build -t damtowise-fyi-api .
docker run --env-file .env -p 8787:8787 damtowise-fyi-api
```

Behind Caddy or Traefik for auto-HTTPS. `api.damtowise.xyz` → the host; no
`id.damtowise.xyz` needed.

`SIGTERM` stops the scheduler, spends any queued deploy hook, closes the server and
drains the pool.

---

## Code review

CodeRabbit reviews every PR against `.coderabbit.yaml`, with `AGENTS.md` as the
guideline file. It already knows this repo's non-obvious rules:

- `db/queries/` returns rows only — no HTTP types, no policy
- webhook signature must be checked before any body field is read
- an empty `ADMIN_USER_IDS` means allow nobody
- the deploy hook must stay debounced; the OG public id already contains its folder
- `GET /health` must never query the database

`.github/workflows/ci.yml` runs `typecheck` → `test` → `build` on every PR;
`reviews.tools.github-checks` waits on it before summarising.

> [!IMPORTANT]
> The GitHub App still has to be installed once, per repo:
> **https://github.com/apps/coderabbitai/installations/new** → select
> `einstein-john/damtowiseFyi`. Config alone does nothing until it is.

---

## Why npm fails

```
npm error code EUNSUPPORTEDPROTOCOL
npm error Unsupported URL Type "workspace:": workspace:./drizzle-orm/dist
```

**This is not a bug in this project.** `drizzle-kit` publishes a manifest whose
`devDependencies` still contains an internal pnpm-monorepo specifier. npm chokes on
the `workspace:` protocol; pnpm resolves it normally.

A `preinstall` guard (`scripts/preinstall.mjs`) blocks npm on a clean install before
it can create the problem. On an existing checkout, recover with:

```bash
pnpm install                 # correct path, lockfile is authoritative
```

Everything else in the output — `ERESOLVE overriding peer dependency`, the
`ts-jest@26.5.6` / `typedoc@0.19.2` warnings — is npm walking a pnpm-shaped
`node_modules` and is pure noise.

---

## Security checklist

- [ ] CORS allows only `SITE_ORIGIN` / `API_PUBLIC_ORIGIN` plus `Authorization`
- [ ] No credentials mode — this is bearer auth, not cookies
- [ ] Rate limits on the webhook **and** admin writes
- [ ] `/admin` CSP: `connect-src` for the API + Neon Auth host, `img-src` for Cloudinary
- [ ] Cloudinary secret, `DATABASE_URL` and the deploy hook URL never reach the browser
- [ ] HTTPS only; usage alerts on Cloudinary and Neon
- [ ] `/admin` excluded from the sitemap and disallowed in `robots.txt`
- [ ] Employer/client screenshots redacted and cleared for publication

---

## Known risks

| Risk | Detail |
| --- | --- |
| **Third-party cookies** | Neon's session cookie is set on Neon's domain with `SameSite=None`. Safari and Brave may block sign-in from `damtowise.xyz`. **Test there first.** If it breaks, check Neon's docs for a supported same-domain proxy. |
| **Beta** | Neon's docs still label this Beta. Recheck before depending on it for anything beyond your own admin login. |
| **Single point of failure** | If the API is down, the webhook cannot respond, so **every** sign-up fails. Fine for a single-admin site; worth remembering if you ever get locked out. |
| **Storage figure** | Neon's announcement and FAQ disagree (0.5 GB vs 1 GB per project). Check your console. |

## Scripts

| Command | Does |
| --- | --- |
| `pnpm dev` | Watch-mode server |
| `pnpm build` | Emit `dist/` (tests excluded) |
| `pnpm start` | Run the built server |
| `pnpm test` | 164 unit tests, no database or network |
| `pnpm typecheck` | Full project including tests |
| `pnpm db:generate` | SQL from `src/db/schema.ts` |
| `pnpm db:migrate` | Apply migrations (needs `DIRECT_DATABASE_URL`) |

CI runs `pnpm typecheck && pnpm test && pnpm build` on every PR. Run the same three
locally before opening one — reviews and CI both fail otherwise.

</div>
