import { compactVerify, decodeProtectedHeader } from "jose";
import type { JwksResolver } from "./keys.js";

export class WebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

export interface VerifyWebhookOptions {
  /** Exact request body bytes; any re-serialisation would break the signature. */
  rawBody: string;
  signature: string;
  keyResolver: JwksResolver;
}

export interface VerifiedWebhook {
  event: Record<string, unknown>;
  kid: string;
}

/**
 * Verifies an Ed25519-signed Neon Auth delivery.
 *
 * The `X-Neon-Signature` header is a compact JWS whose protected header carries
 * `kid` and whose payload is the request body itself. Nothing in the body is
 * trusted until this returns.
 */
export async function verifyWebhookSignature(options: VerifyWebhookOptions): Promise<VerifiedWebhook> {
  const { signature, keyResolver } = options;

  let header: { kid?: string; alg?: string };
  try {
    header = decodeProtectedHeader(signature);
  } catch {
    throw new WebhookSignatureError("Signature is not a valid compact JWS");
  }

  if (!header.kid) throw new WebhookSignatureError("Signature header is missing a kid");
  if (header.alg !== "EdDSA") {
    throw new WebhookSignatureError(`Unexpected signature algorithm: ${header.alg ?? "none"}`);
  }

  let payloadBytes: Uint8Array;
  try {
    ({ payload: payloadBytes } = await compactVerify(signature, keyResolver));
  } catch {
    throw new WebhookSignatureError("Signature verification failed");
  }

  // Binds the signature to the exact bytes received, not a re-serialised body.
  const signedText = new TextDecoder().decode(payloadBytes);
  if (signedText !== options.rawBody) {
    throw new WebhookSignatureError("Signed payload does not match the request body");
  }

  let event: unknown;
  try {
    event = JSON.parse(signedText);
  } catch {
    throw new WebhookSignatureError("Signed payload is not valid JSON");
  }

  if (typeof event !== "object" || event === null || Array.isArray(event)) {
    throw new WebhookSignatureError("Signed payload is not a JSON object");
  }

  const record = event as Record<string, unknown>;
  if (typeof record.timestamp !== "string") {
    throw new WebhookSignatureError("Signed payload is missing a timestamp");
  }

  return { event: record, kid: header.kid };
}