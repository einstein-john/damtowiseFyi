import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PostScheduler } from "./post-scheduler.js";

const NOW = new Date("2026-01-31T12:00:00Z").getTime();

describe("PostScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  function scheduler(options: {
    nextDueAt: Date | null;
    due: string[];
    publish?: (id: string) => Promise<void>;
  }) {
    const publish = options.publish ?? vi.fn(async () => undefined);
    const findNextDueAt = vi.fn(async () => options.nextDueAt);

    return {
      publish,
      findNextDueAt,
      scheduler: new PostScheduler({
        findNextDueAt,
        findDuePostIds: async () => options.due,
        publish,
      }),
    };
  }

  it("starts stopped", () => {
    const { scheduler: subject } = scheduler({ nextDueAt: null, due: [] });

    expect(subject.currentState).toBe("stopped");
  });

  it("arms a timer for the next due post", async () => {
    const { findNextDueAt, scheduler: subject } = scheduler({
      nextDueAt: new Date(NOW + 60_000),
      due: [],
    });

    await subject.start();

    expect(subject.currentState).toBe("armed");
    expect(findNextDueAt).toHaveBeenCalledTimes(1);
  });

  it("publishes due posts when the timer fires", async () => {
    const { publish, scheduler: subject } = scheduler({
      nextDueAt: new Date(NOW + 1_000),
      due: ["a", "b"],
    });

    await subject.start();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledWith("a");
    expect(publish).toHaveBeenCalledWith("b");
  });

  it("re-arms after firing", async () => {
    const { scheduler: subject } = scheduler({ nextDueAt: new Date(NOW + 1_000), due: [] });

    await subject.start();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(subject.currentState).toBe("armed");
  });

  it("does not publish while stopped", async () => {
    const { publish, scheduler: subject } = scheduler({
      nextDueAt: new Date(NOW + 1_000),
      due: ["a"],
    });

    await subject.start();
    subject.stop();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(publish).not.toHaveBeenCalled();
    expect(subject.currentState).toBe("stopped");
  });

  it("keeps publishing the rest when one post fails", async () => {
    const onError = vi.fn();
    const publish = vi.fn(async (id: string) => {
      if (id === "a") throw new Error("boom");
    });

    const subject = new PostScheduler({
      findNextDueAt: async () => new Date(NOW + 1_000),
      findDuePostIds: async () => ["a", "b"],
      publish,
      onError,
    });

    await subject.start();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(publish).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledWith(expect.any(Error), "publishing post a");
  });

  it("survives a failed schedule lookup", async () => {
    const onError = vi.fn();
    const subject = new PostScheduler({
      findNextDueAt: async () => {
        throw new Error("db down");
      },
      findDuePostIds: async () => [],
      publish: async () => undefined,
      onError,
    });

    await subject.start();

    expect(onError).toHaveBeenCalled();
    expect(subject.currentState).toBe("armed");
  });

  it("arm is a no-op while stopped", async () => {
    const { findNextDueAt, scheduler: subject } = scheduler({
      nextDueAt: new Date(NOW + 1_000),
      due: [],
    });

    await subject.arm();

    expect(findNextDueAt).not.toHaveBeenCalled();
  });
});