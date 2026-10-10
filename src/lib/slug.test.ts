import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "./slug.js";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips accents", () => {
    expect(slugify("Crème Brûlée")).toBe("creme-brulee");
  });

  it("collapses separators and trims edges", () => {
    expect(slugify("  --A  B__C--  ")).toBe("a-b-c");
  });

  it("drops characters that are not URL safe", () => {
    expect(slugify("a/b?c=d")).toBe("a-b-c-d");
  });

  it("returns an empty string for symbol-only input", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("uniqueSlug", () => {
  it("returns the slug when it is free", async () => {
    await expect(uniqueSlug("My Post", async () => false)).resolves.toBe("my-post");
  });

  it("falls back to untitled when the name yields nothing", async () => {
    await expect(uniqueSlug("!!!", async () => false)).resolves.toBe("untitled");
  });

  it("appends an incrementing suffix until a slot is free", async () => {
    const taken = new Set(["post", "post-2"]);

    await expect(uniqueSlug("Post", async (candidate) => taken.has(candidate))).resolves.toBe("post-3");
  });
});