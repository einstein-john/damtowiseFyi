import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { TocEntry } from "../contracts/index.js";

export const postStatusEnum = pgEnum("post_status", ["draft", "published", "scheduled"]);

export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  cloudinaryPublicId: text("cloudinary_public_id").notNull().unique(),
  version: integer("version").notNull(),
  format: text("format").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  bytes: integer("bytes").notNull(),
  /** Required unless `decorative` is true — enforced before publishing. */
  alt: text("alt"),
  decorative: boolean("decorative").notNull().default(false),
  caption: text("caption"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt"),
    contentMd: text("content_md").notNull().default(""),
    contentHtml: text("content_html").notNull().default(""),
    toc: jsonb("toc").$type<TocEntry[]>().notNull().default([]),
    coverMediaId: uuid("cover_media_id").references(() => media.id, { onDelete: "set null" }),
    status: postStatusEnum("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    readTime: integer("read_time").notNull().default(1),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    canonicalUrl: text("canonical_url"),
    noindex: boolean("noindex").notNull().default(false),
    ogImageUrl: text("og_image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugUnique: uniqueIndex("posts_slug_unique").on(table.slug),
    listingIdx: index("posts_listing_idx").on(table.status, table.publishedAt),
  }),
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex("tags_slug_unique").on(table.slug),
    nameUnique: uniqueIndex("tags_name_unique").on(table.name),
  }),
);

export const postTags = pgTable(
  "post_tags",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.postId, table.tagId] }),
    tagIdx: index("post_tags_tag_idx").on(table.tagId),
  }),
);

export const worklogItems = pgTable(
  "worklog_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mediaId: uuid("media_id").references(() => media.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    caption: text("caption"),
    tag: text("tag"),
    sortOrder: integer("sort_order").notNull().default(0),
    published: boolean("published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    listingIdx: index("worklog_items_listing_idx").on(table.published, table.sortOrder),
  }),
);

export const slugRedirects = pgTable("slug_redirects", {
  oldSlug: text("old_slug").primaryKey(),
  newSlug: text("new_slug").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MediaRow = typeof media.$inferSelect;
export type NewMediaRow = typeof media.$inferInsert;
export type PostRow = typeof posts.$inferSelect;
export type NewPostRow = typeof posts.$inferInsert;
export type PostPatchRow = Partial<NewPostRow>;
export type TagRow = typeof tags.$inferSelect;
export type WorklogRow = typeof worklogItems.$inferSelect;
export type SlugRedirectRow = typeof slugRedirects.$inferSelect;