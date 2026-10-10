import { describe, expect, it } from "vitest";
import { isTimestampFresh, readEventId, readEventIdFromBody, readSignatureHeader } from "./webhook-headers.js";

const MAX_AGE = 300;

function headers(values: Record<string, string>): Headers {
  return new Headers(values);
}

describe("header readers", () => {
  it("reads the signature header case-insensitively", () => {
    expect(readSignatureHeader(headers({ "X-Neon-Signature": "abc" }))).toBe("abc");
  });

  it("returns null when the signature is absent", () => {
    expect(readSignatureHeader(headers({}))).toBeNull();
  });

  it("reads the event id header", () => {
    expect(readEventId(headers({ "x-neon-event-id": "evt_1" }))).toBe("evt_1");
  });
});

describe("readEventIdFromBody", () => {
  it("reads the id from the signed body", () => {
    expect(readEventIdFromBody({ id: "evt_1" })).toBe("evt_1");
  });

  it("returns null when the body has no usable id", () => {
    expect(readEventIdFromBody({})).toBeNull();
    expect(readEventIdFromBody({ id: "" })).toBeNull();
    expect(readEventIdFromBody(null)).toBeNull();
  });
});

describe("isTimestampFresh", () => {
  const now = Date.parse("2026-01-31T12:00:00Z");

  it("accepts a timestamp inside the tolerance", () => {
    expect(isTimestampFresh("2026-01-31T11:59:00Z", MAX_AGE, now)).toBe(true);
  });

  it("rejects a stale timestamp", () => {
    expect(isTimestampFresh("2026-01-31T11:00:00Z", MAX_AGE, now)).toBe(false);
  });

  it("rejects a timestamp from the future beyond tolerance", () => {
    expect(isTimestampFresh("2026-01-31T13:00:00Z", MAX_AGE, now)).toBe(false);
  });

  it("tolerates a small clock skew", () => {
    expect(isTimestampFresh("2026-01-31T12:02:00Z", MAX_AGE, now)).toBe(true);
  });

  it("rejects an unparseable timestamp", () => {
    expect(isTimestampFresh("not a date", MAX_AGE, now)).toBe(false);
  });
});