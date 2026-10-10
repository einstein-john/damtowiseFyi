import { describe, expect, it } from "vitest";
import { detectImageType, isAllowedMimeType } from "./detect-image-type.js";

function buffer(bytes: number[], padding = 32): Buffer {
  return Buffer.concat([Buffer.from(bytes), Buffer.alloc(padding)]);
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff, 0xe0];

describe("detectImageType", () => {
  it("identifies png", () => {
    expect(detectImageType(buffer(PNG))).toBe("image/png");
  });

  it("identifies jpeg", () => {
    expect(detectImageType(buffer(JPEG))).toBe("image/jpeg");
  });

  it("identifies gif", () => {
    expect(detectImageType(buffer([...Buffer.from("GIF89a")])))
      .toBe("image/gif");
  });

  it("identifies webp", () => {
    const riff = [...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")];
    expect(detectImageType(buffer(riff))).toBe("image/webp");
  });

  it("identifies avif", () => {
    const avif = [0, 0, 0, 0x20, ...Buffer.from("ftypavif")];
    expect(detectImageType(buffer(avif))).toBe("image/avif");
  });

  it("rejects a truncated buffer", () => {
    expect(detectImageType(Buffer.alloc(4))).toBeNull();
  });

  it("rejects a non-image", () => {
    expect(detectImageType(buffer([0x25, 0x50, 0x44, 0x46]))).toBeNull();
  });

  it("rejects an mp4 whose brand merely looks similar", () => {
    const mp4 = [0, 0, 0, 0x18, ...Buffer.from("ftypmp42")];
    expect(detectImageType(buffer(mp4))).toBeNull();
  });
});

describe("isAllowedMimeType", () => {
  it("accepts the supported set", () => {
    expect(isAllowedMimeType("image/webp")).toBe(true);
    expect(isAllowedMimeType("image/svg+xml")).toBe(false);
    expect(isAllowedMimeType("application/pdf")).toBe(false);
  });
});