import type { WorklogInput, WorklogItemSummary, WorklogPatch } from "../contracts/index.js";
import { findMediaById } from "../db/queries/media.js";
import {
  deleteWorklogItem as deleteWorklogRow,
  findWorklogItemById,
  insertWorklogItem,
  listWorklogItems,
  updateWorklogItem,
  updateWorklogOrder,
} from "../db/queries/worklog.js";
import type { MediaRow, WorklogRow } from "../db/schema.js";
import { conflict, notFound } from "../lib/http/errors.js";
import { toWorklogItemSummary } from "../serializers/media.js";
import type { ServiceContext } from "./context.js";

export async function listWorklog(
  ctx: ServiceContext,
  publishedOnly: boolean,
): Promise<WorklogRow[]> {
  return listWorklogItems(ctx.db, { publishedOnly });
}

export async function createWorklogItem(
  ctx: ServiceContext,
  input: WorklogInput,
): Promise<WorklogRow> {
  const media = await resolveMedia(ctx, input.mediaId);
  return insertWorklogItem(ctx.db, {
    title: input.title,
    caption: input.caption ?? null,
    tag: input.tag ?? null,
    sortOrder: input.sortOrder,
    published: input.published,
    mediaId: media?.id ?? null,
  });
}

export async function updateWorklogItemById(
  ctx: ServiceContext,
  id: string,
  patch: WorklogPatch,
): Promise<WorklogRow> {
  const existing = await findWorklogItemById(ctx.db, id);
  if (!existing) throw notFound("Work log item not found");

  const media = patch.mediaId === undefined ? undefined : await resolveMedia(ctx, patch.mediaId);

  const updated = await updateWorklogItem(ctx.db, id, {
    ...(patch.title === undefined ? {} : { title: patch.title }),
    ...(patch.caption === undefined ? {} : { caption: patch.caption ?? null }),
    ...(patch.tag === undefined ? {} : { tag: patch.tag ?? null }),
    ...(patch.sortOrder === undefined ? {} : { sortOrder: patch.sortOrder }),
    ...(patch.published === undefined ? {} : { published: patch.published }),
    ...(media === undefined ? {} : { mediaId: media?.id ?? null }),
  });

  if (!updated) throw notFound("Work log item not found");
  return updated;
}

export async function deleteWorklogItemById(ctx: ServiceContext, id: string): Promise<void> {
  const deleted = await deleteWorklogRow(ctx.db, id);
  if (!deleted) throw notFound("Work log item not found");
  ctx.deployHook.trigger();
}

/** Bulk reorder used by the drag-and-drop list in the admin UI. */
export async function reorderWorklog(
  ctx: ServiceContext,
  entries: ReadonlyArray<{ id: string; sortOrder: number }>,
): Promise<void> {
  await updateWorklogOrder(ctx.db, entries);
  ctx.deployHook.trigger();
}

export async function loadWorklogImages(
  ctx: ServiceContext,
  items: WorklogRow[],
): Promise<Map<string, MediaRow>> {
  const ids = items.map((item) => item.mediaId).filter((id): id is string => id !== null);
  if (ids.length === 0) return new Map();

  const images = await Promise.all(ids.map((id) => findMediaById(ctx.db, id)));
  return new Map(
    images.filter((image): image is MediaRow => image !== null).map((image) => [image.id, image]),
  );
}

/** Work log items with their images resolved into client-facing summaries. */
export async function listWorklogSummaries(
  ctx: ServiceContext,
  publishedOnly: boolean,
): Promise<WorklogItemSummary[]> {
  const items = await listWorklog(ctx, publishedOnly);
  const images = await loadWorklogImages(ctx, items);

  return items.map((item) =>
    toWorklogItemSummary(
      item,
      item.mediaId === null ? null : (images.get(item.mediaId) ?? null),
      ctx.env.CLOUDINARY_CLOUD_NAME,
    ),
  );
}

export async function toWorklogSummary(
  ctx: ServiceContext,
  item: WorklogRow,
): Promise<WorklogItemSummary> {
  const images = await loadWorklogImages(ctx, [item]);
  return toWorklogItemSummary(
    item,
    item.mediaId === null ? null : (images.get(item.mediaId) ?? null),
    ctx.env.CLOUDINARY_CLOUD_NAME,
  );
}

async function resolveMedia(
  ctx: ServiceContext,
  mediaId: string | null | undefined,
): Promise<MediaRow | null> {
  if (mediaId === null || mediaId === undefined) return null;
  const media = await findMediaById(ctx.db, mediaId);
  if (!media) throw conflict("Media does not exist");
  return media;
}