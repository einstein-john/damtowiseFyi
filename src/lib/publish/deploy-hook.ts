export interface DeployHookOptions {
  url: string | undefined;
  debounceMs: number;
  fetchImpl?: typeof fetch;
}

/**
 * Coalesces publish triggers into a single Vercel build.
 *
 * The Hobby plan budgets 100 build minutes per day; editing five posts in a row
 * must not spend five of them. Every `trigger()` inside the window collapses
 * into the pending flush.
 */
export class DebouncedDeployHook {
  private timer: ReturnType<typeof setTimeout> | null = null;

  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: DeployHookOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  get enabled(): boolean {
    return Boolean(this.options.url);
  }

  /** True when a flush is already queued; useful for logging and tests. */
  get pending(): boolean {
    return this.timer !== null;
  }

  trigger(): void {
    if (!this.enabled) return;

    // Sliding window: a trigger inside the window pushes the flush out.
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.fireQueued(), this.options.debounceMs);
  }

  private async fireQueued(): Promise<void> {
    this.timer = null;
    await this.dispatch();
  }

  /** Sends a queued trigger immediately; does nothing if none is pending. */
  async flush(): Promise<void> {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
    await this.dispatch();
  }

  private async dispatch(): Promise<void> {
    const url = this.options.url;
    if (!url) return;

    try {
      const response = await this.fetchImpl(url, { method: "POST" });
      if (!response.ok) {
        console.error(`[deploy] hook responded ${response.status}`);
      }
    } catch (error) {
      // A failed trigger must not break the publish that caused it; the next
      // publish will queue a fresh build.
      console.error("[deploy] hook request failed", error);
    }
  }
}