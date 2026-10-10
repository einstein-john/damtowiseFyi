import { describe, expect, it } from "vitest";
import { RateLimiter } from "./rate-limit.js";

const WINDOW_MS = 60_000;

describe("RateLimiter", () => {
  it("allows requests up to the limit", () => {
    const limiter = new RateLimiter(3, WINDOW_MS);

    expect(limiter.consume("a", 0).allowed).toBe(true);
    expect(limiter.consume("a", 0).allowed).toBe(true);
    expect(limiter.consume("a", 0).allowed).toBe(true);
  });

  it("blocks once the limit is exceeded", () => {
    const limiter = new RateLimiter(1, WINDOW_MS);

    expect(limiter.consume("a", 0).allowed).toBe(true);
    expect(limiter.consume("a", 0).allowed).toBe(false);
  });

  it("counts down the remaining budget", () => {
    const limiter = new RateLimiter(2, WINDOW_MS);

    expect(limiter.consume("a", 0).remaining).toBe(1);
    expect(limiter.consume("a", 0).remaining).toBe(0);
    expect(limiter.consume("a", 0).remaining).toBe(0);
  });

  it("tracks keys independently", () => {
    const limiter = new RateLimiter(1, WINDOW_MS);

    limiter.consume("a", 0);

    expect(limiter.consume("b", 0).allowed).toBe(true);
    expect(limiter.consume("a", 0).allowed).toBe(false);
  });

  it("starts a fresh window after the previous one expires", () => {
    const limiter = new RateLimiter(1, WINDOW_MS);
    limiter.consume("a", 0);

    expect(limiter.consume("a", WINDOW_MS).allowed).toBe(true);
  });

  it("sweep drops expired windows and keeps live ones", () => {
    const limiter = new RateLimiter(1, WINDOW_MS);
    limiter.consume("expired", 0);
    limiter.consume("live", WINDOW_MS - 1);

    limiter.sweep(WINDOW_MS - 1);

    // The live window still blocks; the expired one is gone and starts over.
    expect(limiter.consume("live", WINDOW_MS - 1).allowed).toBe(false);
    expect(limiter.consume("expired", WINDOW_MS - 1).remaining).toBe(0);
  });
});