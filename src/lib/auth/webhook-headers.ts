export const SIGNATURE_HEADER = "x-neon-signature";
export const KID_HEADER = "x-neon-signature-kid";
export const EVENT_ID_HEADER = "x-neon-event-id";

export interface WebhookEvent {
  id: string;
  timestamp: string;
  event: string;
  data: unknown;
}

export function readSignatureHeader(headers: Headers): string | null {
  return headers.get(SIGNATURE_HEADER);
}

export function readEventId(headers: Headers): string | null {
  return headers.get(EVENT_ID_HEADER);
}

/**
 * Neon Auth stamps the delivery time inside the signed body. Anything outside the
 * tolerance is a replay, so we fail closed rather than guess.
 */
export function isTimestampFresh(timestamp: string, maxAgeSeconds: number, now: number): boolean {
  const issuedAt = Date.parse(timestamp);
  if (Number.isNaN(issuedAt)) return false;

  const ageSeconds = (now - issuedAt) / 1000;
  return ageSeconds <= maxAgeSeconds && ageSeconds >= -maxAgeSeconds;
}

/** Best-effort event id; falls back to the signed body so dedupe still works. */
export function readEventIdFromBody(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const candidate = (payload as { id?: unknown }).id;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}