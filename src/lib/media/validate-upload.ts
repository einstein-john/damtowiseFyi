import { MAX_UPLOAD_BYTES, type AllowedMimeType } from "../../contracts/index.js";
import { detectImageType, isAllowedMimeType } from "./detect-image-type.js";

export interface UploadCandidate {
  filename: string;
  declaredMimeType: string;
  bytes: Buffer;
}

export interface ValidatedUpload {
  mimeType: AllowedMimeType;
  bytes: Buffer;
  filename: string;
}

/** Declared type, real (magic-byte) type and size, all gated before any Cloudinary call. */
export function validateUpload(candidate: UploadCandidate): ValidatedUpload {
  if (candidate.bytes.byteLength === 0) {
    throw new Error("Uploaded file is empty");
  }

  if (candidate.bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(
      `File is larger than the ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB limit`,
    );
  }

  if (!isAllowedMimeType(candidate.declaredMimeType)) {
    throw new Error(`Unsupported content type: ${candidate.declaredMimeType}`);
  }

  const actual = detectImageType(candidate.bytes);
  if (actual === null) {
    throw new Error("File is not a recognised image");
  }
  if (actual !== candidate.declaredMimeType) {
    throw new Error(
      `File content is ${actual} but was declared as ${candidate.declaredMimeType}`,
    );
  }

  return {
    mimeType: actual,
    bytes: candidate.bytes,
    filename: sanitizeFilename(candidate.filename),
  };
}

/** Keeps a readable base name while guaranteeing Cloudinary-safe characters. */
export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "upload";
  const withoutExtension = base.replace(/\.[^.]+$/, "");
  const cleaned = withoutExtension
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return cleaned.length > 0 ? cleaned : "upload";
}