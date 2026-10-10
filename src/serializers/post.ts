import {
  cloudinaryImagePreviewUrl,
  type MediaRef,
  type PostDetail,
  type PostSummary,
  type TagSummary,
} from "../contracts/index.js";
import type { MediaRow, PostRow, TagRow } from "../db/schema.js";

function toTagSummary(row: TagRow): TagSummary {
  return { id: row.id, name: row.name, slug: row.slug };
}

function toIso(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

export function toMediaRef(row: MediaRow): MediaRef {
  return {
    id: row.id,
    alt: row.alt,
    decorative: row.decorative,
    caption: row.caption,
    cloudinaryPublicId: row.cloudinaryPublicId,
    version: row.version,
    format: row.format,
    width: row.width,
    height: row.height,
  };
}

export function toPostSummary(params: {
  post: PostRow;
  tags: TagRow[];
  cover: MediaRow | null;
  cloudName: string;
}): PostSummary {
  const { post, tags, cover, cloudName } = params;

  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    coverImageUrl: cover ? cloudinaryImagePreviewUrl(cloudName, toMediaRef(cover)) : null,
    tags: tags.map(toTagSummary),
    publishedAt: toIso(post.publishedAt),
    readTime: post.readTime,
  };
}

export function toPostDetail(params: {
  post: PostRow;
  tags: TagRow[];
  cover: MediaRow | null;
  cloudName: string;
}): PostDetail {
  return {
    ...toPostSummary(params),
    contentHtml: params.post.contentHtml,
    toc: params.post.toc,
    seoTitle: params.post.seoTitle,
    seoDescription: params.post.seoDescription,
    canonicalUrl: params.post.canonicalUrl,
    noindex: params.post.noindex,
    ogImageUrl: params.post.ogImageUrl,
    createdAt: params.post.createdAt.toISOString(),
    updatedAt: params.post.updatedAt.toISOString(),
  };
}