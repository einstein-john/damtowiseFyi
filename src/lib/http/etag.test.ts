import { describe, expect, it } from "vitest";
import { computeEtag, etagMatches } from "./etag.js";

describe("computeEtag", () => {
  it("is stable for byte-identical payloads", () => {
    expect(computeEtag({ a: 1 })).toBe(computeEtag({ a: 1 }));
  });

  it("changes when the payload changes", () => {
    expect(computeEtag({ a: 1 })).not.toBe(computeEtag({ a: 2 }));
  });

  it("is quoted", () => {
    expect(computeEtag("x")).toMatch(/^"[A-Za-z0-9_-]+"$/);
  });
});

describe("etagMatches", () => {
  const etag = computeEtag({ a: 1 });

  it("does not match an absent header", () => {
    expect(etagMatches(undefined, etag)).toBe(false);
  });

  it("matches a wildcard", () => {
    expect(etagMatches("*", etag)).toBe(true);
  });

  it("matches the exact tag within a list", () => {
    expect(etagMatches(`"other", ${etag}`, etag)).toBe(true);
  });

  it("matches a weak variant", () => {
    expect(etagMatches(`W/${etag}`, etag)).toBe(true);
  });

  it("rejects a different tag", () => {
    expect(etagMatches('"nope"', etag)).toBe(false);
  });
});