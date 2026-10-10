/**
 * Compiles queries against an in-memory proxy driver, catching table and column
 * typos that a mocked repository would otherwise hide. No database required.
 */

import { drizzle } from "drizzle-orm/pg-proxy";
import { and, eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { Database } from "../client.js";
import * as schema from "../schema.js";

interface Compiled {
  sql: string;
  params: unknown[];
}

/** Captures the SQL each query would have sent. */
function createQueryHarness() {
  const captured: Compiled[] = [];

  const db = drizzle(
    async (sql: string, params: unknown[]) => {
      captured.push({ sql, params });
      return { rows: [] };
    },
    { schema },
  );

  return { db: db as unknown as Database, captured };
}

describe("schema defaults", () => {
  it("lists the post status values", () => {
    expect(schema.postStatusEnum.enumValues).toEqual(["draft", "published", "scheduled"]);
  });

  it("requires a slug and a title", () => {
    expect(schema.posts.slug.notNull).toBe(true);
    expect(schema.posts.title.notNull).toBe(true);
  });

  it("leaves alt nullable but marks decorative as not null", () => {
    expect(schema.media.alt.notNull).toBe(false);
    expect(schema.media.decorative.notNull).toBe(true);
  });

  it("keys redirects by the old slug", () => {
    expect(schema.slugRedirects.oldSlug.primary).toBe(true);
  });
});

describe("post queries", () => {
  it("filters the public listing to published posts only", async () => {
    const { db, captured } = createQueryHarness();

    await db
      .select()
      .from(schema.posts)
      .where(and(eq(schema.posts.status, "published"), sql`true`));

    expect(captured[0]?.sql).toContain('"posts"."status" = $1');
    expect(captured[0]?.params).toContain("published");
  });

  it("joins tags through the link table", async () => {
    const { db, captured } = createQueryHarness();

    await db
      .select({ postId: schema.postTags.postId })
      .from(schema.postTags)
      .innerJoin(schema.tags, eq(schema.tags.id, schema.postTags.tagId));

    expect(captured[0]?.sql).toContain('inner join "tags"');
  });

  it("carries the new title and updatedAt on an update", async () => {
    const { db, captured } = createQueryHarness();
    const now = new Date("2026-01-31T12:00:00Z");

    await db.update(schema.posts).set({ title: "New", updatedAt: now }).where(eq(schema.posts.id, "x"));

    expect(captured[0]?.sql).toContain('"updated_at" =');
    expect(captured[0]?.params).toContain("New");
    expect(captured[0]?.params.some((param) => String(param).includes("2026-01-31"))).toBe(true);
  });

  it("orders published posts newest first with nulls last", async () => {
    const { db, captured } = createQueryHarness();

    await db
      .select()
      .from(schema.posts)
      .orderBy(sql`${schema.posts.publishedAt} desc nulls last`);

    expect(captured[0]?.sql).toContain("nulls last");
  });
});

describe("media queries", () => {
  it("matches post bodies containing a media ref", async () => {
    const { db, captured } = createQueryHarness();
    const id = "11111111-1111-4111-8111-111111111111";

    await db
      .select()
      .from(schema.posts)
      .where(sql`${schema.posts.contentMd} LIKE ${`%media:${id}%`}`);

    expect(captured[0]?.sql).toContain('"posts"."content_md" LIKE $1');
    expect(captured[0]?.params).toContain(`%media:${id}%`);
  });

  it("filters posts by cover media id", async () => {
    const { db, captured } = createQueryHarness();

    await db.select().from(schema.posts).where(eq(schema.posts.coverMediaId, "abc"));

    expect(captured[0]?.sql).toContain('"posts"."cover_media_id" =');
  });
});

describe("redirect queries", () => {
  it("upserts on conflict of the old slug", async () => {
    const { db, captured } = createQueryHarness();

    await db
      .insert(schema.slugRedirects)
      .values({ oldSlug: "old", newSlug: "new" })
      .onConflictDoUpdate({ target: schema.slugRedirects.oldSlug, set: { newSlug: "newer" } });

    expect(captured[0]?.sql).toContain("on conflict");
  });
});

describe("tag queries", () => {
  it("resolves a list of ids with an IN clause", async () => {
    const { db, captured } = createQueryHarness();

    await db
      .select({ id: schema.tags.id })
      .from(schema.tags)
      .where(sql`${schema.tags.id} = any(${[1]})`);

    expect(captured[0]?.sql).toContain('"tags"."id" = any');
  });
});