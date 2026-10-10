import { describe, expect, it } from "vitest";
import type { MediaRef } from "../../contracts/index.js";
import { renderMarkdown } from "./render.js";

const MEDIA_ID = "11111111-1111-4111-8111-111111111111";

const media: MediaRef = {
  id: MEDIA_ID,
  alt: "A server rack",
  decorative: false,
  caption: "Rack 4",
  cloudinaryPublicId: "fyi/rack",
  version: 1712345678,
  format: "jpg",
  width: 2400,
  height: 1600,
};

const options = { cloudName: "demo", mediaById: new Map([[MEDIA_ID, media]]) };

describe("renderMarkdown", () => {
  it("renders GFM tables", async () => {
    const { html } = await renderMarkdown("| a | b |\n| - | - |\n| 1 | 2 |", options);

    expect(html).toContain("<table>");
    expect(html).toContain("<td>1</td>");
  });

  it("builds a toc from heading ids", async () => {
    const { toc } = await renderMarkdown("## First\n\n### Second", options);

    expect(toc).toEqual([
      { depth: 2, slug: "first", text: "First" },
      { depth: 3, slug: "second", text: "Second" },
    ]);
  });

  it("strips script tags", async () => {
    const { html } = await renderMarkdown("<script>alert(1)</script>", options);

    expect(html).not.toContain("script");
  });

  it("strips javascript: urls", async () => {
    const { html } = await renderMarkdown("[x](javascript:alert(1))", options);

    expect(html).not.toContain("javascript:");
  });

  it("replaces a media ref with a figure carrying a srcset", async () => {
    const { html } = await renderMarkdown(`![A server rack](media:${MEDIA_ID})`, options);

    expect(html).toContain("<figure");
    expect(html).toContain("srcset=");
    expect(html).toContain('alt="A server rack"');
    expect(html).toContain("<figcaption>Rack 4</figcaption>");
  });

  it("keeps intrinsic dimensions and lazy loading", async () => {
    const { html } = await renderMarkdown(`![x](media:${MEDIA_ID})`, options);

    expect(html).toContain('width="2400"');
    expect(html).toContain('height="1600"');
    expect(html).toContain('loading="lazy"');
  });

  it("emits empty alt and role=presentation for decorative images", async () => {
    const decorative: MediaRef = { ...media, alt: null, decorative: true, caption: null };
    const { html } = await renderMarkdown(`![ignored](media:${MEDIA_ID})`, {
      cloudName: "demo",
      mediaById: new Map([[MEDIA_ID, decorative]]),
    });

    expect(html).toContain('alt=""');
    expect(html).toContain('role="presentation"');
    expect(html).not.toContain("<figcaption>");
  });

  it("leaves an unknown media ref unrenderable rather than leaking the scheme", async () => {
    const { html } = await renderMarkdown(`![missing](media:${MEDIA_ID})`, {
      cloudName: "demo",
      mediaById: new Map(),
    });

    expect(html).not.toContain("media:");
  });

  it("computes read time from the source markdown", async () => {
    const words = Array.from({ length: 226 }, () => "word").join(" ");
    const { readTime } = await renderMarkdown(words, options);

    expect(readTime).toBe(2);
  });
});