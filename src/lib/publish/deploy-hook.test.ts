import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DebouncedDeployHook } from "./deploy-hook.js";

const HOOK_URL = "https://api.vercel.com/v1/integrations/deploy/prj_abc";

describe("DebouncedDeployHook", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function hook(debounceMs = 60_000) {
    const fetchImpl = vi.fn(async () => new Response("ok", { status: 200 }));
    return { fetchImpl, deployHook: new DebouncedDeployHook({ url: HOOK_URL, debounceMs, fetchImpl }) };
  }

  it("is disabled without a url", async () => {
    const deployHook = new DebouncedDeployHook({ url: undefined, debounceMs: 60_000 });

    expect(deployHook.enabled).toBe(false);
    deployHook.trigger();
    await vi.advanceTimersByTimeAsync(120_000);

    expect(deployHook.pending).toBe(false);
  });

  it("does not fire before the debounce window elapses", async () => {
    const { fetchImpl, deployHook } = hook();

    deployHook.trigger();
    await vi.advanceTimersByTimeAsync(59_000);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fires once after the window", async () => {
    const { fetchImpl, deployHook } = hook();

    deployHook.trigger();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(HOOK_URL, { method: "POST" });
  });

  it("coalesces many triggers into a single call", async () => {
    const { fetchImpl, deployHook } = hook();

    for (let i = 0; i < 10; i += 1) {
      deployHook.trigger();
      await vi.advanceTimersByTimeAsync(1_000);
    }
    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("flush sends a queued trigger immediately", async () => {
    const { fetchImpl, deployHook } = hook();

    deployHook.trigger();
    await deployHook.flush();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(deployHook.pending).toBe(false);
  });

  it("flush with nothing queued is a no-op", async () => {
    const { fetchImpl, deployHook } = hook();

    await deployHook.flush();

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not retry a failed trigger", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 500 }));
    const deployHook = new DebouncedDeployHook({ url: HOOK_URL, debounceMs: 1_000, fetchImpl });

    deployHook.trigger();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("swallows a network error instead of surfacing it", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const deployHook = new DebouncedDeployHook({ url: HOOK_URL, debounceMs: 1_000, fetchImpl });

    deployHook.trigger();

    // Neither the timer callback nor flush may reject on a transport failure.
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(deployHook.flush()).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});