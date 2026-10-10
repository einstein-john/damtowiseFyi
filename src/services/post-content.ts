import type { MediaRef } from "../contracts/index.js";
import { findMediaById, findMediaByIds } from "../db/queries/media.js";
import type { MediaRow, PostRow } from "../db/schema.js";
import { collectMediaRefs } from "../lib/markdown/collect-media-refs.js";
import { renderMarkdown, type RenderedMarkdown } from "../lib/markdown/render.js";
import { toMediaRef } from "../serializers/post.js";
import type { ServiceContext } from "./context.js";

function toMap(rows: readonly MediaRow[]): Map<string, MediaRef> {
  return new Map(rows.map((row) => [row.id, toMediaRef(row)]));
}

/** Loads the media a post body points at, in the order they first appear. */
export async function loadBodyMedia(ctx: ServiceContext, contentMd: string): Promise<MediaRow[]> {
  const ids = collectMediaRefs(contentMd);
  if (ids.length === 0) return [];

  const rows = await findMediaByIds(ctx.db, ids);
  const byId = new Map(rows.map((row) => [row.id, row]));
  // Preserve document order so render-time lookups and diagnostics line up with the body.
  return ids.map((id) => byId.get(id)).filter((row): row is MediaRow => row !== undefined);
}

export async function loadCoverMedia(
  ctx: ServiceContext,
  post: Pick<PostRow, "coverMediaId">,
): Promise<MediaRow | null> {
  if (!post.coverMediaId) return null;
  return findMediaById(ctx.db, post.coverMediaId);
}

/** Renders a post body and returns the values stored on the row. */
export async function renderPostBody(
  ctx: ServiceContext,
  contentMd: string,
  bodyMedia: readonly MediaRow[],
): Promise<RenderedMarkdown> {
  return renderMarkdown(contentMd, {
    cloudName: ctx.env.CLOUDINARY_CLOUD_NAME,
    mediaById: toMap(bodyMedia),
  });
}