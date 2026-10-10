import { describe, expect, it } from "vitest";
import { estimateReadTime } from "./read-time.js";

describe("estimateReadTime", () => {
  it("returns at least one minute for empty content", () => {
    expect(estimateReadTime("")).toBe(1);
  });

  it("counts words across newlines and extra whitespace", () => {
    expect(estimateReadTime("one two\n\nthree   four ")).toBe(1);
  });

  it("rounds up to the next minute", () => {
    const words = Array.from({ length: 226 }, () => "word").join(" ");
    expect(estimateReadTime(words)).toBe(2);
  });

  it("honours a custom words-per-minute rate", () => {
    const words = Array.from({ length: 200 }, () => "word").join(" ");
    expect(estimateReadTime(words, 100)).toBe(2);
  });
});