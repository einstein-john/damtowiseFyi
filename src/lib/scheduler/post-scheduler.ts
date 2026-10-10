/** Node clamps `setTimeout` above this; longer waits must re-arm. */
const MAX_TIMEOUT_MS = 2_147_483_647;

export interface PostSchedulerOptions {
  /** Earliest `publishedAt` strictly after the given instant. */
  findNextDueAt: (after: Date) => Promise<Date | null>;
  /** Ids of posts whose `publishedAt` has arrived. */
  findDuePostIds: (now: Date) => Promise<string[]>;
  publish: (postId: string) => Promise<void>;
  onError?: (error: unknown, context: string) => void;
}

export type SchedulerState = "stopped" | "armed" | "firing";

/**
 * Publishes scheduled posts without polling the database.
 *
 * One timer is armed for the next due `publishedAt`; firing it publishes
 * everything that has come due and immediately re-arms. This in-memory timer is
 * the only reason the API needs a long-running host.
 */
export class PostScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private state: SchedulerState = "stopped";

  constructor(private readonly options: PostSchedulerOptions) {}

  get currentState(): SchedulerState {
    return this.state;
  }

  async start(): Promise<void> {
    if (this.state !== "stopped") return;
    this.state = "armed";
    await this.schedule();
  }

  /** Re-reads the schedule; call after any schedule, publish or unpublish request. */
  async arm(): Promise<void> {
    if (this.state === "stopped") return;
    await this.schedule();
  }

  stop(): void {
    this.clearTimer();
    this.state = "stopped";
  }

  private async schedule(): Promise<void> {
    this.clearTimer();

    const next = await this.findNextDueAt(new Date());
    if (!next) return;

    const delay = next.getTime() - Date.now();
    // A wait longer than the timer ceiling re-arms on wake instead of firing early.
    this.timer = setTimeout(() => void this.onTimer(), Math.max(0, Math.min(delay, MAX_TIMEOUT_MS)));
  }

  private async onTimer(): Promise<void> {
    this.timer = null;
    if (this.state === "stopped") return;

    this.state = "firing";
    try {
      await this.publishDue();
    } finally {
      this.state = "armed";
      await this.schedule();
    }
  }

  private async publishDue(): Promise<void> {
    const due = await this.options.findDuePostIds(new Date());
    if (due.length === 0) return;

    for (const postId of due) {
      try {
        await this.options.publish(postId);
      } catch (error) {
        this.report(error, `publishing post ${postId}`);
      }
    }
  }

  private async findNextDueAt(from: Date): Promise<Date | null> {
    try {
      return await this.options.findNextDueAt(from);
    } catch (error) {
      this.report(error, "loading the next scheduled post");
      return null;
    }
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private report(error: unknown, context: string): void {
    if (this.options.onError) this.options.onError(error, context);
    else console.error(`[scheduler] ${context}`, error);
  }
}