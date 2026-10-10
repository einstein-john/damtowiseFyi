import { describe, expect, it } from "vitest";
import { decideSignup, extractUserEmail, SIGNUP_EVENT } from "./signup-gate.js";

const context = { allowSignup: true, adminEmail: "admin@damtowise.xyz" };

function payload(email: string | null): Record<string, unknown> {
  return { data: email === null ? {} : { user: { email } } };
}

describe("extractUserEmail", () => {
  it("reads the email from a nested user object", () => {
    expect(extractUserEmail({ data: { user: { email: "a@b.c" } } })).toBe("a@b.c");
  });

  it("reads the email from a flat object", () => {
    expect(extractUserEmail({ email: "a@b.c" })).toBe("a@b.c");
  });

  it("returns null when no email is present", () => {
    expect(extractUserEmail({ data: {} })).toBeNull();
    expect(extractUserEmail(null)).toBeNull();
    expect(extractUserEmail("nope")).toBeNull();
  });
});

describe("decideSignup", () => {
  it("allows the admin address while the flag is on", () => {
    expect(decideSignup(context, SIGNUP_EVENT, payload("admin@damtowise.xyz")).allowed).toBe(true);
  });

  it("matches the email case-insensitively", () => {
    expect(decideSignup(context, SIGNUP_EVENT, payload("  Admin@Damtowise.XYZ ")).allowed).toBe(true);
  });

  it("rejects any other address", () => {
    expect(decideSignup(context, SIGNUP_EVENT, payload("someone@else.com")).allowed).toBe(false);
  });

  it("rejects everything once the flag is off", () => {
    const closed = { ...context, allowSignup: false };

    expect(decideSignup(closed, SIGNUP_EVENT, payload("admin@damtowise.xyz")).allowed).toBe(false);
  });

  it("rejects a payload with no email", () => {
    expect(decideSignup(context, SIGNUP_EVENT, payload(null)).allowed).toBe(false);
  });

  it("does not gate unrelated events", () => {
    expect(decideSignup(context, "user.after_create", payload("x@y.z")).allowed).toBe(true);
  });

  it("explains why it rejected", () => {
    expect(decideSignup(context, SIGNUP_EVENT, payload(null)).reason).toMatch(/no email/i);
  });
});