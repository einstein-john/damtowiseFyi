import {
  cloudinaryImagePreviewUrl,
  type MediaSummary,
  type WorklogItemSummary,
} from "../contracts/index.js";
import type { MediaRow, WorklogRow } from "../db/schema.js";
import { toMediaRef } from "./post.js";

export function toMediaSummary(row: MediaRow, cloudName: string): MediaSummary {
  return {
    id: row.id,
    url: cloudinaryImagePreviewUrl(cloudName, toMediaRef(row)),
    width: row.width,
    height: row.height,
    alt: row.alt,
    decorative: row.decorative,
    caption: row.caption,
    bytes: row.bytes,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toWorklogItemSummary(
  row: WorklogRow,
  image: MediaRow | null,
  cloudName: string,
): WorklogItemSummary {
  return {
    id: row.id,
    title: row.title,
    caption: row.caption,
    tag: row.tag,
    sortOrder: row.sortOrder,
    published: row.published,
    mediaId: row.mediaId,
    imageUrl: image ? cloudinaryImagePreviewUrl(cloudName, toMediaRef(image)) : null,
    imageAlt: image?.alt ?? null,
    imageWidth: image?.width ?? null,
    imageHeight: image?.height ?? null,
  };
}