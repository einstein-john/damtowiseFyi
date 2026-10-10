import { describe, expect, it } from "vitest";
import { EventDedupeStore } from "./event-dedupe.js";

const TTL = 1_000;

describe("EventDedupeStore", () => {
  it("treats an unrecorded id as new", () => {
    expect(new EventDedupeStore(TTL).has("a")).toBe(false);
  });

  it("reports a recorded id as seen", () => {
    const store = new EventDedupeStore(TTL);
    store.record("a");

    expect(store.has("a")).toBe(true);
  });

  it("forgets an id once the ttl has passed", () => {
    const store = new EventDedupeStore(TTL);
    store.record("a", 0);

    expect(store.has("a", TTL)).toBe(false);
  });

  it("evicts the oldest entry when the cap is reached", () => {
    const store = new EventDedupeStore(TTL, 2);
    store.record("a", 0);
    store.record("b", 0);
    store.record("c", 0);

    expect(store.has("a", 0)).toBe(false);
    expect(store.has("c", 0)).toBe(true);
  });

  it("prunes expired entries when recording", () => {
    const store = new EventDedupeStore(TTL);
    store.record("a", 0);
    store.record("b", TTL * 2);

    expect(store.has("b", TTL * 2)).toBe(true);
  });
});