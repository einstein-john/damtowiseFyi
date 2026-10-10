import { CompactSign, generateKeyPair, exportJWK, type JWK } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import type { JwksResolver } from "./keys.js";
import { verifyWebhookSignature, WebhookSignatureError } from "./verify-webhook-signature.js";

const KID = "test-key";

type Ed25519Key = Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];

let privateKey: Ed25519Key;
let otherPrivateKey: Ed25519Key;
let jwk: JWK;
let resolver: JwksResolver;

async function signRaw(payload: string, algorithm = "EdDSA"): Promise<string> {
  const key = algorithm === "EdDSA" ? privateKey : new Uint8Array(32);

  return new CompactSign(new TextEncoder().encode(payload))
    .setProtectedHeader({ alg: algorithm, kid: KID })
    .sign(key);
}

async function sign(body: unknown): Promise<string> {
  return signRaw(JSON.stringify(body));
}

/** Replaces the signature segment with a well-formed but wrong signature. */
function withForgedSignature(token: string): string {
  const parts = token.split(".");
  parts[2] = parts[2]?.replace(/^./, (first) => (first === "A" ? "B" : "A")) ?? "";
  return parts.join(".");
}

beforeAll(async () => {
  const pair = await generateKeyPair("EdDSA");
  const other = await generateKeyPair("EdDSA");
  privateKey = pair.privateKey;
  otherPrivateKey = other.privateKey;
  jwk = await exportJWK(pair.publicKey);
  jwk.kid = KID;

  resolver = async (protectedHeader) => {
    if (protectedHeader?.kid !== KID) throw new Error("unknown kid");
    return jwk as never;
  };
});

const event = {
  id: "evt_1",
  timestamp: new Date().toISOString(),
  event: "user.before_create",
  data: { user: { email: "admin@damtowise.xyz" } },
};

describe("verifyWebhookSignature", () => {
  it("returns the signed event and the kid", async () => {
    const rawBody = JSON.stringify(event);

    const result = await verifyWebhookSignature({
      rawBody,
      signature: await sign(event),
      keyResolver: resolver,
    });

    expect(result.event).toEqual(event);
    expect(result.kid).toBe(KID);
  });

  it("rejects a signature made with a different key", async () => {
    const rawBody = JSON.stringify(event);
    const forged = await new CompactSign(new TextEncoder().encode(rawBody))
      .setProtectedHeader({ alg: "EdDSA", kid: KID })
      .sign(otherPrivateKey);

    await expect(
      verifyWebhookSignature({ rawBody, signature: forged, keyResolver: resolver }),
    ).rejects.toBeInstanceOf(WebhookSignatureError);
  });

  it("rejects a corrupted signature segment", async () => {
    const rawBody = JSON.stringify(event);

    await expect(
      verifyWebhookSignature({
        rawBody,
        signature: withForgedSignature(await sign(event)),
        keyResolver: resolver,
      }),
    ).rejects.toThrow(/verification failed/i);
  });

  it("rejects a body that differs from the signed payload", async () => {
    const tamperedBody = JSON.stringify({
      ...event,
      data: { user: { email: "attacker@evil.com" } },
    });

    await expect(
      verifyWebhookSignature({
        rawBody: tamperedBody,
        signature: await sign(event),
        keyResolver: resolver,
      }),
    ).rejects.toThrow(/does not match the request body/i);
  });

  it("rejects a non-JWS signature", async () => {
    await expect(
      verifyWebhookSignature({ rawBody: "{}", signature: "nonsense", keyResolver: resolver }),
    ).rejects.toThrow(/compact JWS/i);
  });

  it("rejects an unexpected algorithm", async () => {
    const rawBody = JSON.stringify(event);

    await expect(
      verifyWebhookSignature({
        rawBody,
        signature: await signRaw(rawBody, "HS256"),
        keyResolver: resolver,
      }),
    ).rejects.toThrow(/algorithm/i);
  });

  it("rejects a payload with no timestamp", async () => {
    const withoutTimestamp = { id: "evt_2", event: "user.before_create" };

    await expect(
      verifyWebhookSignature({
        rawBody: JSON.stringify(withoutTimestamp),
        signature: await sign(withoutTimestamp),
        keyResolver: resolver,
      }),
    ).rejects.toThrow(/timestamp/i);
  });

  it("rejects a payload that is not a JSON object", async () => {
    const rawBody = "[1,2,3]";

    await expect(
      verifyWebhookSignature({ rawBody, signature: await signRaw(rawBody), keyResolver: resolver }),
    ).rejects.toThrow(/JSON object/i);
  });

  it("rejects a payload that is not JSON at all", async () => {
    const rawBody = "not json";

    await expect(
      verifyWebhookSignature({ rawBody, signature: await signRaw(rawBody), keyResolver: resolver }),
    ).rejects.toThrow(/valid JSON/i);
  });
});