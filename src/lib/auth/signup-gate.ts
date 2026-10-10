export const SIGNUP_EVENT = "user.before_create";

export interface SignupContext {
  allowSignup: boolean;
  adminEmail: string;
}

/** Neon sends the user object either at the top level or under `data.user`. */
export function extractUserEmail(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;

  const root = payload as Record<string, unknown>;
  const candidates: unknown[] = [
    (root.data as Record<string, unknown> | undefined)?.user,
    root.data,
    root.user,
    root,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "object" || candidate === null) continue;
    const email = (candidate as Record<string, unknown>).email;
    if (typeof email === "string") return email;
  }

  return null;
}

export interface SignupDecision {
  allowed: boolean;
  reason: string;
}

/**
 * The single sign-up gate: only the admin address, and only while the bootstrap
 * flag is on. Everything else — including a missing email — is rejected.
 */
export function decideSignup(context: SignupContext, eventName: string, payload: unknown): SignupDecision {
  if (eventName !== SIGNUP_EVENT) {
    return { allowed: true, reason: `event "${eventName}" is not gated` };
  }

  if (!context.allowSignup) {
    return { allowed: false, reason: "Sign-ups are closed (ALLOW_SIGNUP is false)" };
  }

  const email = extractUserEmail(payload);
  if (email === null) {
    return { allowed: false, reason: "Sign-up payload has no email address" };
  }

  if (email.trim().toLowerCase() !== context.adminEmail.trim().toLowerCase()) {
    return { allowed: false, reason: `Email ${email} is not the allowlisted admin address` };
  }

  return { allowed: true, reason: "Allowlisted admin address" };
}