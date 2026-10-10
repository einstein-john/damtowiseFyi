import { describe, expect, it } from "vitest";
import type { MediaRow } from "../../db/schema.js";
import { collectAltTextIssues, collectPublishIssues, type PublishChecksInput } from "./checks.js";

function mediaRow(overrides: Partial<MediaRow> = {}): MediaRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    cloudinaryPublicId: "fyi/a",
    version: 1,
    format: "jpg",
    width: 800,
    height: 600,
    bytes: 1000,
    alt: "A described image",
    decorative: false,
    caption: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function validInput(overrides: Partial<PublishChecksInput> = {}): PublishChecksInput {
  return {
    slug: "a-valid-slug",
    contentMd: "Some body copy.",
    excerpt: "A short summary.",
    seoTitle: "A title",
    seoDescription: "A description",
    coverMedia: null,
    bodyMedia: [],
    ...overrides,
  };
}

function fields(input: PublishChecksInput): string[] {
  return collectPublishIssues(input).map((issue) => issue.field);
}

describe("collectPublishIssues", () => {
  it("passes a complete post", () => {
    expect(collectPublishIssues(validInput())).toEqual([]);
  });

  it("rejects a malformed slug", () => {
    expect(fields(validInput({ slug: "Not A Slug" }))).toContain("slug");
  });

  it("rejects an empty body", () => {
    expect(fields(validInput({ contentMd: "   " }))).toContain("contentMd");
  });

  it("requires an excerpt", () => {
    expect(fields(validInput({ excerpt: null }))).toContain("excerpt");
    expect(fields(validInput({ excerpt: "   " }))).toContain("excerpt");
  });

  it("requires an SEO title and description", () => {
    const issues = fields(validInput({ seoTitle: null, seoDescription: null }));

    expect(issues).toContain("seoTitle");
    expect(issues).toContain("seoDescription");
  });

  it("reports every missing field at once", () => {
    expect(collectPublishIssues(validInput({ excerpt: null, seoTitle: null }))).toHaveLength(2);
  });
});

describe("collectAltTextIssues", () => {
  it("accepts described images", () => {
    expect(collectAltTextIssues(validInput({ bodyMedia: [mediaRow()] }))).toEqual([]);
  });

  it("accepts decorative images without alt text", () => {
    const decorative = mediaRow({ alt: null, decorative: true });

    expect(collectAltTextIssues(validInput({ bodyMedia: [decorative] }))).toEqual([]);
  });

  it("rejects an image whose alt is only whitespace", () => {
    expect(collectAltTextIssues(validInput({ bodyMedia: [mediaRow({ alt: "  " })] }))).toHaveLength(1);
  });

  it("rejects a cover image with no alt text", () => {
    const issues = collectAltTextIssues(validInput({ coverMedia: mediaRow({ alt: null }) }));

    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain("11111111");
  });

  it("counts the cover and the body separately", () => {
    const issues = collectAltTextIssues(
      validInput({ coverMedia: mediaRow({ alt: null }), bodyMedia: [mediaRow({ alt: null, id: "other" })] }),
    );

    expect(issues).toHaveLength(2);
  });
});