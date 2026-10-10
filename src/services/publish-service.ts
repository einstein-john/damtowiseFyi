import { findPostById, updatePostFields } from "../db/queries/posts.js";
import { recordRedirect } from "../db/queries/redirects.js";
import type { PostRow, TagRow } from "../db/schema.js";
import { notFound, unprocessable } from "../lib/http/errors.js";
import { destroyImage } from "../lib/media/cloudinary.js";
import { ogPublicId } from "../lib/og/asset.js";
import { collectPublishIssues, type PublishChecksInput, type PublishIssue } from "../lib/publish/checks.js";
import { generateOgImage } from "../lib/publish/generate-og-image.js";
import type { ServiceContext } from "./context.js";
import { loadBodyMedia, loadCoverMedia, renderPostBody } from "./post-content.js";

const SITE_NAME = "damtowise";

/** The post fields the publish checks depend on. */
function toCheckInput(params: {
  post: PostRow;
  cover: Awaited<ReturnType<typeof loadCoverMedia>>;
  bodyMedia: Awaited<ReturnType<typeof loadBodyMedia>>;
}): PublishChecksInput {
  return {
    slug: params.post.slug,
    contentMd: params.post.contentMd,
    excerpt: params.post.excerpt,
    seoTitle: params.post.seoTitle,
    seoDescription: params.post.seoDescription,
    coverMedia: params.cover,
    bodyMedia: params.bodyMedia,
  };
}

function toApiIssue(issue: PublishIssue): { path: string; message: string } {
  return { path: issue.field, message: issue.message };
}

async function loadForPublish(ctx: ServiceContext, postId: string) {
  const found = await findPostById(ctx.db, postId);
  if (!found) throw notFound("Post not found");

  const [cover, bodyMedia] = await Promise.all([
    loadCoverMedia(ctx, found.post),
    loadBodyMedia(ctx, found.post.contentMd),
  ]);

  return { ...found, cover, bodyMedia };
}

async function writeOgImage(
  ctx: ServiceContext,
  post: PostRow,
  tags: TagRow[],
): Promise<string> {
  const og = await generateOgImage({
    env: ctx.env,
    cloudinary: ctx.cloudinary,
    source: { slug: post.slug, title: post.title, excerpt: post.excerpt, tags },
    siteName: SITE_NAME,
  });
  return og.url;
}

/** Runs the blocking checks and returns them rather than throwing, for the editor UI. */
export async function inspectPublishReadiness(
  ctx: ServiceContext,
  postId: string,
): Promise<PublishIssue[]> {
  const loaded = await loadForPublish(ctx, postId);
  return collectPublishIssues(toCheckInput(loaded));
}

/**
 * Publish: verify, render, generate the social card, flip the status, then queue
 * one debounced site rebuild.
 */
export async function publishPost(ctx: ServiceContext, postId: string): Promise<PostRow> {
  const loaded = await loadForPublish(ctx, postId);

  const issues = collectPublishIssues(toCheckInput(loaded));
  if (issues.length > 0) {
    throw unprocessable("Post is not ready to publish", issues.map(toApiIssue));
  }

  const rendered = await renderPostBody(ctx, loaded.post.contentMd, loaded.bodyMedia);
  const ogImageUrl = await writeOgImage(ctx, loaded.post, loaded.tags);

  const updated = await updatePostFields(ctx.db, postId, {
    status: "published",
    publishedAt: loaded.post.publishedAt ?? new Date(),
    contentHtml: rendered.html,
    toc: rendered.toc,
    readTime: rendered.readTime,
    ogImageUrl,
  });

  if (!updated) throw notFound("Post not found");

  ctx.deployHook.trigger();
  return updated;
}

/** Returns a post to draft, keeping its content and social card. */
export async function unpublishPost(ctx: ServiceContext, postId: string): Promise<PostRow> {
  const updated = await updatePostFields(ctx.db, postId, { status: "draft", publishedAt: null });
  if (!updated) throw notFound("Post not found");

  ctx.deployHook.trigger();
  return updated;
}

/** Regenerates the social card when a published post's content of record changed. */
export async function refreshOgImage(ctx: ServiceContext, postId: string): Promise<PostRow> {
  const { post, tags } = await loadForPublish(ctx, postId);
  const ogImageUrl = await writeOgImage(ctx, post, tags);

  const updated = await updatePostFields(ctx.db, postId, { ogImageUrl });
  if (!updated) throw notFound("Post not found");
  return updated;
}

/** Records the old slug and deletes the social card left at its public id. */
export async function handleSlugChange(
  ctx: ServiceContext,
  previousSlug: string,
  nextSlug: string,
): Promise<void> {
  if (previousSlug === nextSlug) return;

  await recordRedirect(ctx.db, previousSlug, nextSlug);
  try {
    await destroyImage(ctx.cloudinary, ogPublicId(previousSlug));
  } catch (error) {
    // A missing OG asset must not fail the save that triggered this.
    console.warn(`[publish] could not delete OG asset for "${previousSlug}"`, error);
  }
}