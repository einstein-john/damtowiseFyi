const DEFAULT_MAX_ENTRIES = 1_000;

/**
 * Bounded, in-memory replay protection for webhook deliveries. Entries are held
 * for `ttlMs` (must exceed the signature tolerance) and the oldest is dropped
 * once the cap is reached, so a flood cannot grow the map without limit.
 */
export class EventDedupeStore {
  private readonly seen = new Map<string, number>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number = DEFAULT_MAX_ENTRIES,
  ) {}

  /** Returns true when the id was already recorded (i.e. this is a replay). */
  has(id: string, now: number = Date.now()): boolean {
    const recordedAt = this.seen.get(id);
    if (recordedAt === undefined) return false;

    if (now - recordedAt >= this.ttlMs) {
      this.seen.delete(id);
      return false;
    }
    return true;
  }

  record(id: string, now: number = Date.now()): void {
    this.prune(now);
    this.seen.set(id, now);
  }

  private prune(now: number): void {
    for (const [id, recordedAt] of this.seen) {
      if (now - recordedAt >= this.ttlMs) this.seen.delete(id);
    }
    while (this.seen.size >= this.maxEntries) {
      const oldest = this.seen.keys().next();
      if (oldest.done) return;
      this.seen.delete(oldest.value);
    }
  }
}