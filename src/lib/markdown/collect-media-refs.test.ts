import { describe, expect, it } from "vitest";
import { collectMediaRefs, isMediaRef } from "./collect-media-refs.js";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

describe("isMediaRef", () => {
  it("matches the media prefix", () => {
    expect(isMediaRef(`media:${ID_A}`)).toBe(true);
  });

  it("rejects an ordinary url", () => {
    expect(isMediaRef("https://example.com/a.png")).toBe(false);
  });

  it("rejects null", () => {
    expect(isMediaRef(null)).toBe(false);
  });
});

describe("collectMediaRefs", () => {
  it("returns ids in first-appearance order, deduplicated", () => {
    const markdown = `A ![one](media:${ID_A}) B ![two](media:${ID_B}) C ![again](media:${ID_A})`;

    expect(collectMediaRefs(markdown)).toEqual([ID_A, ID_B]);
  });

  it("ignores refs inside fenced code blocks", () => {
    const markdown = ["```", `![sample](media:${ID_A})`, "```", "", `![real](media:${ID_B})`].join("\n");

    expect(collectMediaRefs(markdown)).toEqual([ID_B]);
  });

  it("ignores refs inside inline code", () => {
    expect(collectMediaRefs(`use \`media:${ID_A}\` like this`)).toEqual([]);
  });

  it("ignores a non-uuid payload", () => {
    expect(collectMediaRefs("![x](media:not-a-uuid)")).toEqual([]);
  });

  it("returns nothing for plain markdown", () => {
    expect(collectMediaRefs("# Title\n\nSome prose.")).toEqual([]);
  });
});