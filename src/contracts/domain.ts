export const POST_STATUSES = ["draft", "published", "scheduled"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

/** Post bodies reference uploads as `![alt](media:<uuid>)`. */
export const MEDIA_REF_PREFIX = "media:";

/** Widths emitted into `srcset` for article images. */
export const SRCSET_WIDTHS = [480, 800, 1200] as const;
export type SrcsetWidth = (typeof SRCSET_WIDTHS)[number];

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export interface TocEntry {
  depth: number;
  slug: string;
  text: string;
}

export interface MediaRef {
  id: string;
  alt: string | null;
  decorative: boolean;
  caption: string | null;
  cloudinaryPublicId: string;
  version: number;
  format: string;
  width: number;
  height: number;
}

export interface PostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  tags: TagSummary[];
  publishedAt: string | null;
  readTime: number;
}

export interface PostDetail extends PostSummary {
  contentHtml: string;
  toc: TocEntry[];
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  noindex: boolean;
  ogImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TagSummary {
  id: string;
  name: string;
  slug: string;
}

export interface MediaSummary {
  id: string;
  url: string;
  width: number;
  height: number;
  alt: string | null;
  decorative: boolean;
  caption: string | null;
  bytes: number;
  createdAt: string;
}

export interface WorklogItemSummary {
  id: string;
  title: string;
  caption: string | null;
  tag: string | null;
  sortOrder: number;
  published: boolean;
  mediaId: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
}

export interface SlugRedirect {
  oldSlug: string;
  newSlug: string;
}

export interface AdminIdentity {
  userId: string;
  email: string | null;
}