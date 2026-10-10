import { describe, expect, it } from "vitest";
import {
  toAdminPostDetail,
  toAdminPostSummary,
  toPostDetail,
  toPostSummary,
} from "./post.js";
import type { MediaRow, PostRow, TagRow } from "../db/schema.js";

const post = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "api-scanner",
  title: "Building an API Scanner",
  excerpt: "How the scanner works.",
  contentMd: "# Building an API Scanner\n\nbody",
  contentHtml: "<h1>Building an API Scanner</h1><p>body</p>",
  toc: [{ depth: 2, slug: "body", text: "body" }],
  coverMediaId: "22222222-2222-4222-8222-222222222222",
  status: "draft",
  publishedAt: null,
  readTime: 4,
  seoTitle: "Building an API Scanner",
  seoDescription: "How the scanner works.",
  canonicalUrl: null,
  noindex: false,
  ogImageUrl: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
} satisfies PostRow;

const tag = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Node.js",
  slug: "nodejs",
} satisfies TagRow;

const cover = {
  id: "22222222-2222-4222-8222-222222222222",
  cloudinaryPublicId: "fyi/cover",
  version: 1700000000,
  format: "webp",
  width: 2400,
  height: 1600,
  bytes: 120_000,
  alt: "A terminal window",
  decorative: false,
  caption: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
} satisfies MediaRow;

const params = { post, tags: [tag], cover, cloudName: "damtowise" };

describe("public post serializers", () => {
  it("never expose the editable source or the workflow status", () => {
    const summary = toPostSummary(params);
    const detail = toPostDetail(params);

    expect(summary).not.toHaveProperty("contentMd");
    expect(summary).not.toHaveProperty("status");
    expect(detail).not.toHaveProperty("contentMd");
    expect(detail).not.toHaveProperty("status");
  });

  it("serialise dates as ISO strings", () => {
    const detail = toPostDetail(params);

    expect(detail.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(detail.updatedAt).toBe("2026-01-02T00:00:00.000Z");
    expect(detail.coverImageUrl).toContain("res.cloudinary.com");
  });
});

describe("admin post serializers", () => {
  it("carry the status the registry table filters on", () => {
    expect(toAdminPostSummary(params).status).toBe("draft");
    expect(toAdminPostDetail(params).status).toBe("draft");
  });

  it("carry the raw markdown the studio round-trips", () => {
    const detail = toAdminPostDetail(params);

    expect(detail.contentMd).toBe(post.contentMd);
    // The rendered HTML stays available so the live preview needs no client renderer.
    expect(detail.contentHtml).toBe(post.contentHtml);
  });

  it("leave every public field untouched", () => {
    const { status: _status, contentMd: _source, ...publicFields } = toAdminPostDetail(params);

    expect(publicFields).toEqual(toPostDetail(params));
  });
});
