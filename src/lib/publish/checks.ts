import {
  EXCERPT_MAX_LENGTH,
  SEO_DESCRIPTION_MAX_LENGTH,
  SEO_TITLE_MAX_LENGTH,
  slugSchema,
} from "../../contracts/index.js";
import { hasUsableAlt } from "../../db/queries/media.js";
import type { MediaRow } from "../../db/schema.js";

export interface PublishChecksInput {
  slug: string;
  contentMd: string;
  excerpt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  coverMedia: MediaRow | null;
  /** Every media item referenced from the post body, already resolved. */
  bodyMedia: MediaRow[];
}

export interface PublishIssue {
  field: "slug" | "contentMd" | "excerpt" | "seoTitle" | "seoDescription" | "altText";
  message: string;
}

function isBlank(value: string | null): boolean {
  return value === null || value.trim().length === 0;
}

/**
 * Blocking checks run on every publish and on every scheduled publish.
 * Slug uniqueness is not checked here: it is guaranteed by a unique index and
 * enforced at write time, so a conflict can never survive to this point.
 */
export function collectPublishIssues(input: PublishChecksInput): PublishIssue[] {
  const issues: PublishIssue[] = [];

  if (!slugSchema.safeParse(input.slug).success) {
    issues.push({ field: "slug", message: `Slug "${input.slug}" is not a valid URL segment` });
  }

  if (input.contentMd.trim().length === 0) {
    issues.push({ field: "contentMd", message: "Post body is empty" });
  }

  if (isBlank(input.excerpt)) {
    issues.push({ field: "excerpt", message: "An excerpt is required" });
  } else if ((input.excerpt ?? "").length > EXCERPT_MAX_LENGTH) {
    issues.push({
      field: "excerpt",
      message: `Excerpt is longer than ${EXCERPT_MAX_LENGTH} characters`,
    });
  }

  if (isBlank(input.seoTitle)) {
    issues.push({ field: "seoTitle", message: "An SEO title is required" });
  } else if ((input.seoTitle ?? "").length > SEO_TITLE_MAX_LENGTH) {
    issues.push({
      field: "seoTitle",
      message: `SEO title is longer than ${SEO_TITLE_MAX_LENGTH} characters`,
    });
  }

  if (isBlank(input.seoDescription)) {
    issues.push({ field: "seoDescription", message: "An SEO description is required" });
  } else if ((input.seoDescription ?? "").length > SEO_DESCRIPTION_MAX_LENGTH) {
    issues.push({
      field: "seoDescription",
      message: `SEO description is longer than ${SEO_DESCRIPTION_MAX_LENGTH} characters`,
    });
  }

  issues.push(...collectAltTextIssues(input));
  return issues;
}

/** Every image — cover included — needs alt text unless flagged decorative. */
export function collectAltTextIssues(input: PublishChecksInput): PublishIssue[] {
  const issues: PublishIssue[] = [];

  if (input.coverMedia && !hasUsableAlt(input.coverMedia)) {
    issues.push({ field: "altText", message: `Cover image "${input.coverMedia.id}" has no alt text` });
  }

  for (const media of input.bodyMedia) {
    if (!hasUsableAlt(media)) {
      issues.push({ field: "altText", message: `Image "${media.id}" has no alt text` });
    }
  }

  return issues;
}