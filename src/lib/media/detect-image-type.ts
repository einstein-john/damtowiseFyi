import { ALLOWED_MIME_TYPES, type AllowedMimeType } from "../../contracts/index.js";

function startsWith(buffer: Buffer, bytes: number[], offset = 0): boolean {
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

function asciiAt(buffer: Buffer, offset: number, length: number): string {
  return buffer.subarray(offset, offset + length).toString("latin1");
}

const AVIF_BRANDS = new Set(["avif", "avis"]);

/**
 * Identifies an image from its magic bytes. The browser-declared MIME type is
 * attacker-controlled, so this is the check that actually matters.
 */
export function detectImageType(buffer: Buffer): AllowedMimeType | null {
  if (buffer.length < 12) return null;

  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (asciiAt(buffer, 0, 6) === "GIF87a" || asciiAt(buffer, 0, 6) === "GIF89a") return "image/gif";

  if (asciiAt(buffer, 0, 4) === "RIFF" && asciiAt(buffer, 8, 4) === "WEBP") return "image/webp";

  if (asciiAt(buffer, 4, 4) === "ftyp" && AVIF_BRANDS.has(asciiAt(buffer, 8, 4))) return "image/avif";

  return null;
}

export function isAllowedMimeType(mime: string): mime is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}