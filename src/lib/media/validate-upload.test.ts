import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES } from "../../contracts/index.js";
import { sanitizeFilename, validateUpload } from "./validate-upload.js";

const PNG_BYTES = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const JPEG_BYTES = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);

function upload(overrides: Partial<Parameters<typeof validateUpload>[0]> = {}) {
  return {
    filename: "photo.png",
    declaredMimeType: "image/png",
    bytes: PNG_BYTES,
    ...overrides,
  };
}

describe("validateUpload", () => {
  it("accepts a png with a matching declaration", () => {
    expect(validateUpload(upload()).mimeType).toBe("image/png");
  });

  it("rejects an empty file", () => {
    expect(() => validateUpload(upload({ bytes: Buffer.alloc(0) }))).toThrow(/empty/i);
  });

  it("rejects a file over the size limit", () => {
    const oversized = Buffer.alloc(MAX_UPLOAD_BYTES + 1);

    expect(() => validateUpload(upload({ bytes: oversized }))).toThrow(/larger than/i);
  });

  it("rejects an unsupported declared type", () => {
    expect(() => validateUpload(upload({ declaredMimeType: "image/svg+xml" }))).toThrow(
      /unsupported content type/i,
    );
  });

  it("rejects a declared type that does not match the bytes", () => {
    expect(() => validateUpload(upload({ declaredMimeType: "image/jpeg" }))).toThrow(
      /declared as/i,
    );
  });

  it("rejects bytes that are not an image at all", () => {
    const pdf = Buffer.concat([Buffer.from("%PDF"), Buffer.alloc(64)]);

    expect(() => validateUpload(upload({ declaredMimeType: "image/png", bytes: pdf }))).toThrow(
      /not a recognised image/i,
    );
  });

  it("returns the sanitised filename", () => {
    expect(validateUpload(upload({ filename: "My Photo (1).png" })).filename).toBe("My-Photo-1");
  });
});

describe("sanitizeFilename", () => {
  it("keeps only the base name, discarding any path", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
  });

  it("falls back when nothing usable remains", () => {
    expect(sanitizeFilename("...")).toBe("upload");
  });

  it("caps very long names", () => {
    expect(sanitizeFilename(`${"a".repeat(200)}.png`)).toHaveLength(60);
  });
});