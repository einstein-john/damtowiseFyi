import type { PostInput, PostPatch } from "../contracts/index.js";
import { findMediaById, findMediaByIds } from "../db/queries/media.js";
import {
  deletePost as deletePostRow,
  findPostById,
  findPostBySlug,
  insertPost,
  listAllPosts,
  listPublishedPosts,
  makeSlugTakenCheck,
  setPostTags,
  slugExists,
  updatePostFields,
  type PostWithTags,
} from "../db/queries/posts.js";
import { resolveTagIds } from "../db/queries/tags.js";
import type { MediaRow } from "../db/schema.js";
import { conflict, notFound } from "../lib/http/errors.js";
import { destroyImage } from "../lib/media/cloudinary.js";
import { ogPublicId } from "../lib/og/asset.js";
import { slugify, uniqueSlug } from "../lib/slug.js";
import type { ServiceContext } from "./context.js";
import { loadBodyMedia, renderPostBody } from "./post-content.js";
import { handleSlugChange, refreshOgImage } from "./publish-service.js";

/** Fields whose change makes an already-published social card stale. */
const OG_RELEVANT_FIELDS = ["title", "excerpt", "coverMediaId", "tagIds"] as const;

function affectsOgImage(patch: PostPatch): boolean {
  return OG_RELEVANT_FIELDS.some((field) => field in patch);
}

function nullable<T>(value: T | null | undefined): T | null {
  return value === null || value === undefined ? null : value;
}

function toDateOrNull(value: string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  return new Date(value);
}

async function requireExistingCover(
  ctx: ServiceContext,
  coverMediaId: string | null | undefined,
): Promise<MediaRow | null> {
  if (coverMediaId === null || coverMediaId === undefined) return null;
  const cover = await findMediaById(ctx.db, coverMediaId);
  if (!cover) throw conflict("Cover image does not exist");
  return cover;
}

async function requireExistingTags(ctx: ServiceContext, tagIds: readonly string[]): Promise<string[]> {
  const resolved = await resolveTagIds(ctx.db, tagIds);
  if (resolved.length !== tagIds.length) throw conflict("One or more tags do not exist");
  return resolved;
}

async function requirePost(ctx: ServiceContext, id: string): Promise<PostWithTags> {
  const found = await findPostById(ctx.db, id);
  if (!found) throw notFound("Post not found");
  return found;
}

export async function createPost(ctx: ServiceContext, input: PostInput): Promise<PostWithTags> {
  await requireExistingCover(ctx, input.coverMediaId);
  const tagIds = await requireExistingTags(ctx, input.tagIds);
  const bodyMedia = await loadBodyMedia(ctx, input.contentMd);

  const slug = input.slug ?? (await uniqueSlug(slugify(input.title), makeSlugTakenCheck(ctx.db)));
  if (await slugExists(ctx.db, slug)) {
    throw conflict(`Slug "${slug}" is already in use`);
  }

  const rendered = await renderPostBody(ctx, input.contentMd, bodyMedia);

  const row = await insertPost(ctx.db, {
    slug,
    title: input.title,
    excerpt: nullable(input.excerpt),
    contentMd: input.contentMd,
    contentHtml: rendered.html,
    toc: rendered.toc,
    readTime: rendered.readTime,
    coverMediaId: nullable(input.coverMediaId),
    status: input.status,
    publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
    seoTitle: nullable(input.seoTitle),
    seoDescription: nullable(input.seoDescription),
    canonicalUrl: nullable(input.canonicalUrl),
    noindex: input.noindex,
  });

  await setPostTags(ctx.db, row.id, tagIds);
  return requirePost(ctx, row.id);
}

/**
 * Applies a partial update. Slug changes are recorded as redirects; edits to a
 * published post refresh the social card and queue one rebuild.
 */
export async function updatePost(
  ctx: ServiceContext,
  id: string,
  patch: PostPatch,
): Promise<PostWithTags> {
  const existing = await findPostById(ctx.db, id);
  if (!existing) throw notFound("Post not found");

  if (patch.coverMediaId !== undefined) await requireExistingCover(ctx, patch.coverMediaId);
  const tagIds = patch.tagIds ? await requireExistingTags(ctx, patch.tagIds) : null;

  let nextSlug = existing.post.slug;
  if (patch.slug !== undefined && patch.slug !== existing.post.slug) {
    if (await slugExists(ctx.db, patch.slug, id)) {
      throw conflict(`Slug "${patch.slug}" is already in use`);
    }
    nextSlug = patch.slug;
  }

  const rendered =
    patch.contentMd === undefined
      ? null
      : await renderPostBody(ctx, patch.contentMd, await loadBodyMedia(ctx, patch.contentMd));

  const updated = await updatePostFields(ctx.db, id, {
    ...(patch.title === undefined ? {} : { title: patch.title }),
    ...(patch.slug === undefined ? {} : { slug: nextSlug }),
    ...(patch.excerpt === undefined ? {} : { excerpt: nullable(patch.excerpt) }),
    ...(patch.contentMd === undefined ? {} : { contentMd: patch.contentMd }),
    ...(rendered === null
      ? {}
      : { contentHtml: rendered.html, toc: rendered.toc, readTime: rendered.readTime }),
    ...(patch.status === undefined ? {} : { status: patch.status }),
    ...(patch.publishedAt === undefined ? {} : { publishedAt: toDateOrNull(patch.publishedAt) }),
    ...(patch.coverMediaId === undefined ? {} : { coverMediaId: nullable(patch.coverMediaId) }),
    ...(patch.seoTitle === undefined ? {} : { seoTitle: nullable(patch.seoTitle) }),
    ...(patch.seoDescription === undefined ? {} : { seoDescription: nullable(patch.seoDescription) }),
    ...(patch.canonicalUrl === undefined ? {} : { canonicalUrl: nullable(patch.canonicalUrl) }),
    ...(patch.noindex === undefined ? {} : { noindex: patch.noindex }),
  });

  if (!updated) throw notFound("Post not found");

  if (tagIds) await setPostTags(ctx.db, id, tagIds);

  const slugChanged = nextSlug !== existing.post.slug;
  if (slugChanged) await handleSlugChange(ctx, existing.post.slug, nextSlug);

  const needsOgRefresh =
    updated.status === "published" && (affectsOgImage(patch) || slugChanged);

  if (needsOgRefresh) {
    await refreshOgImage(ctx, id);
  }

  if (needsOgRefresh || slugChanged || patch.contentMd !== undefined) {
    ctx.deployHook.trigger();
  }

  return requirePost(ctx, id);
}

/** Deletes the post and its social card; post_tags cascade in the database. */
export async function deletePost(ctx: ServiceContext, id: string): Promise<void> {
  const existing = await findPostById(ctx.db, id);
  if (!existing) throw notFound("Post not found");

  await deletePostRow(ctx.db, id);

  try {
    await destroyImage(ctx.cloudinary, ogPublicId(existing.post.slug));
  } catch (error) {
    console.warn(`[posts] could not delete OG asset for "${existing.post.slug}"`, error);
  }

  ctx.deployHook.trigger();
}

export async function listPublished(
  ctx: ServiceContext,
  options: { tagSlug?: string; page: number; pageSize: number },
): Promise<{ items: PostWithTags[]; total: number }> {
  return listPublishedPosts(ctx.db, options);
}

export async function listAll(
  ctx: ServiceContext,
  page: { page: number; pageSize: number },
): Promise<{ items: PostWithTags[]; total: number }> {
  return listAllPosts(ctx.db, page);
}

/** Public reads only ever expose posts that are actually live. */
export async function findPublishedBySlug(
  ctx: ServiceContext,
  slug: string,
): Promise<PostWithTags | null> {
  const found = await findPostBySlug(ctx.db, slug);
  return found && found.post.status === "published" ? found : null;
}

/** Any post regardless of status; used by the admin API only. */
export async function getPost(ctx: ServiceContext, id: string): Promise<PostWithTags> {
  return requirePost(ctx, id);
}

export async function loadCovers(
  ctx: ServiceContext,
  rows: PostWithTags[],
): Promise<Map<string, MediaRow>> {
  const ids = rows
    .map((row) => row.post.coverMediaId)
    .filter((id): id is string => id !== null);

  if (ids.length === 0) return new Map();

  const covers = await findMediaByIds(ctx.db, ids);
  return new Map(covers.map((cover) => [cover.id, cover]));
}

export function coverFor(row: PostWithTags, covers: Map<string, MediaRow>): MediaRow | null {
  const id = row.post.coverMediaId;
  return id === null ? null : covers.get(id) ?? null;
}