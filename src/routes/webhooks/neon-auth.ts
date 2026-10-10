import { Hono } from "hono";
import type { Env } from "../../config/env.js";
import { authKeys } from "../../middleware/require-admin.js";
import { EventDedupeStore } from "../../lib/auth/event-dedupe.js";
import { decideSignup } from "../../lib/auth/signup-gate.js";
import {
  isTimestampFresh,
  readEventId,
  readEventIdFromBody,
  readSignatureHeader,
} from "../../lib/auth/webhook-headers.js";
import { WebhookSignatureError, verifyWebhookSignature } from "../../lib/auth/verify-webhook-signature.js";
import type { RateLimiter } from "../../lib/rate-limit.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import type { AppEnv } from "../../types.js";

export interface NeonAuthWebhookOptions {
  env: Env;
  limiter: RateLimiter;
  dedupeStore: EventDedupeStore;
}

/**
 * Neon Auth `user.before_create` gate.
 *
 * Order matters: rate limit -> signature -> replay -> payload decision. Nothing
 * in the body is inspected before the signature verifies. This is a blocking
 * event, so `{ allowed: false }` (or any non-2xx) rejects the sign-up — which
 * also means the API being down blocks every sign-up attempt.
 */
export function createNeonAuthWebhookRoutes(options: NeonAuthWebhookOptions): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const { env } = options;

  app.post("/webhooks/neon-auth", rateLimit({ limiter: options.limiter, bucket: "webhook-neon-auth" }), async (c) => {
    const rawBody = await c.req.text();
    const headers = c.req.raw.headers;
    const signature = readSignatureHeader(headers);

    if (signature === null) {
      return c.json({ allowed: false, error: "missing_signature" }, 401);
    }

    let verified;
    try {
      verified = await verifyWebhookSignature({
        rawBody,
        signature,
        keyResolver: authKeys(env).resolveKey,
      });
    } catch (error) {
      const reason = error instanceof WebhookSignatureError ? error.message : "verification failed";
      console.warn("[webhook] rejected", reason);
      return c.json({ allowed: false, error: "invalid_signature" }, 401);
    }

    const event = verified.event;
    const timestamp = typeof event.timestamp === "string" ? event.timestamp : null;

    if (timestamp === null || !isTimestampFresh(timestamp, env.WEBHOOK_SIGNATURE_MAX_AGE_SECONDS, Date.now())) {
      return c.json({ allowed: false, error: "stale_timestamp" }, 401);
    }

    const eventId = readEventId(headers) ?? readEventIdFromBody(event);
    if (eventId !== null) {
      if (options.dedupeStore.has(eventId)) {
        return c.json({ allowed: true, error: "duplicate" });
      }
      options.dedupeStore.record(eventId);
    }

    const eventName = typeof event.event === "string" ? event.event : "";
    const decision = decideSignup(
      { allowSignup: env.ALLOW_SIGNUP, adminEmail: env.ADMIN_EMAIL },
      eventName,
      event.data ?? event,
    );

    if (!decision.allowed) {
      console.warn(`[webhook] sign-up rejected: ${decision.reason}`);
      return c.json({ allowed: false, error: "not_allowed", reason: decision.reason });
    }

    return c.json({ allowed: true });
  });

  return app;
}