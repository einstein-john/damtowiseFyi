import { conflict, notFound } from "../lib/http/errors.js";
import {
  countMediaReferences,
  deleteMediaRow,
  findMediaById,
  insertMedia,
  listMedia,
  totalMediaReferences,
  updateMediaFields,
} from "../db/queries/media.js";
import type { MediaRow } from "../db/schema.js";
import { destroyImage, uploadImage } from "../lib/media/cloudinary.js";
import { validateUpload, type UploadCandidate } from "../lib/media/validate-upload.js";
import type { MediaFields, MediaPatch } from "../contracts/index.js";
import type { ServiceContext } from "./context.js";

export interface CreateMediaInput {
  file: UploadCandidate;
  fields: MediaFields;
}

/** Validate, then upload; Cloudinary is only reached once every check passes. */
export async function createMedia(ctx: ServiceContext, input: CreateMediaInput): Promise<MediaRow> {
  const validated = validateUpload(input.file);

  const uploaded = await uploadImage(ctx.cloudinary, validated.bytes, {
    folder: ctx.env.CLOUDINARY_FOLDER,
  });

  return insertMedia(ctx.db, {
    cloudinaryPublicId: uploaded.publicId,
    version: uploaded.version,
    format: uploaded.format,
    width: uploaded.width,
    height: uploaded.height,
    bytes: uploaded.bytes,
    alt: input.fields.alt?.trim() ? input.fields.alt.trim() : null,
    decorative: input.fields.decorative,
    caption: input.fields.caption?.trim() ? input.fields.caption.trim() : null,
  });
}

export async function listMediaPage(
  ctx: ServiceContext,
  page: { page: number; pageSize: number },
): Promise<{ items: MediaRow[]; total: number }> {
  return listMedia(ctx.db, page);
}

export async function updateMedia(
  ctx: ServiceContext,
  id: string,
  patch: MediaPatch,
): Promise<MediaRow> {
  const existing = await findMediaById(ctx.db, id);
  if (!existing) throw notFound("Media not found");

  const updated = await updateMediaFields(ctx.db, id, {
    ...(patch.alt === undefined ? {} : { alt: patch.alt?.trim() ? patch.alt.trim() : null }),
    ...(patch.decorative === undefined ? {} : { decorative: patch.decorative }),
    ...(patch.caption === undefined ? {} : { caption: patch.caption?.trim() ? patch.caption.trim() : null }),
  });

  if (!updated) throw notFound("Media not found");
  return updated;
}

/** Removes the Cloudinary asset only once nothing references the media row. */
export async function deleteMedia(ctx: ServiceContext, id: string): Promise<void> {
  const existing = await findMediaById(ctx.db, id);
  if (!existing) throw notFound("Media not found");

  const references = await countMediaReferences(ctx.db, id);
  const total = totalMediaReferences(references);
  if (total > 0) {
    throw conflict(
      `Media is still referenced (${total} reference(s)) and cannot be deleted`,
    );
  }

  await destroyImage(ctx.cloudinary, existing.cloudinaryPublicId);
  await deleteMediaRow(ctx.db, id);
}

/** Multipart form fields arrive as strings; coerce them before validation. */
export function parseMediaFields(form: Record<string, string>): MediaFields {
  return {
    alt: form.alt ?? null,
    decorative: form.decorative === "true",
    caption: form.caption ?? null,
  };
}