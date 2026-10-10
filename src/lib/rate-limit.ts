export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Unix ms at which the current window ends. */
  resetAt: number;
}

interface Window {
  count: number;
  resetAt: number;
}

/**
 * In-process fixed-window counter. Adequate for a single API instance; swap for a
 * shared store if the API is ever scaled horizontally.
 */
export class RateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  consume(key: string, now: number = Date.now()): RateLimitDecision {
    const existing = this.windows.get(key);

    if (!existing || existing.resetAt <= now) {
      const resetAt = now + this.windowMs;
      this.windows.set(key, { count: 1, resetAt });
      return { allowed: true, limit: this.limit, remaining: this.limit - 1, resetAt };
    }

    existing.count += 1;
    const allowed = existing.count <= this.limit;
    return {
      allowed,
      limit: this.limit,
      remaining: Math.max(0, this.limit - existing.count),
      resetAt: existing.resetAt,
    };
  }

  /** Drops expired windows; call periodically so the map cannot grow unbounded. */
  sweep(now: number = Date.now()): void {
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
  }
}

/** Runs `sweep` on an unref'd interval so it never holds the process open. */
export function startRateLimiterSweep(limiter: RateLimiter, intervalMs = 60_000): () => void {
  const timer = setInterval(() => limiter.sweep(), intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}