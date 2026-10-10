import type { Element, ElementContent, Root } from "hast";
import { visit } from "unist-util-visit";
import {
  MEDIA_REF_PREFIX,
  SRCSET_WIDTHS,
  cloudinaryImageSrcset,
  cloudinaryImageUrl,
  type MediaRef,
} from "../../contracts/index.js";

export interface MediaFigureOptions {
  cloudName: string;
  /** Resolved up-front so the plugin stays synchronous. */
  mediaById: ReadonlyMap<string, MediaRef>;
  /** Mirrors `sizes` for the 1200w descriptor; the site overrides it in CSS if needed. */
  sizes?: string;
}

const DEFAULT_SIZES = `(max-width: 800px) ${SRCSET_WIDTHS[0]}px, ${SRCSET_WIDTHS[2]}px`;

function mediaIdFromTarget(target: string): string | null {
  if (!target.startsWith(MEDIA_REF_PREFIX)) return null;
  const id = target.slice(MEDIA_REF_PREFIX.length);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
}

function buildFigure(node: Element, media: MediaRef, options: MediaFigureOptions): Element {
  const alt = media.decorative ? "" : (media.alt ?? "");

  const asset = {
    cloudinaryPublicId: media.cloudinaryPublicId,
    version: media.version,
    format: media.format,
  };

  const image: Element = {
    type: "element",
    tagName: "img",
    properties: {
      src: cloudinaryImageUrl({
        cloudName: options.cloudName,
        ...asset,
        width: SRCSET_WIDTHS[SRCSET_WIDTHS.length - 1],
      }),
      srcSet: cloudinaryImageSrcset(options.cloudName, asset),
      sizes: options.sizes ?? DEFAULT_SIZES,
      alt,
      width: media.width,
      height: media.height,
      loading: "lazy",
      decoding: "async",
      className: ["article-figure__image"],
      ...(media.decorative ? { role: "presentation" } : {}),
    },
    children: [],
  };

  const children: ElementContent[] = [image];

  if (media.caption) {
    children.push({
      type: "element",
      tagName: "figcaption",
      properties: { className: ["article-figure__caption"] },
      children: [{ type: "text", value: media.caption }],
    });
  }

  return {
    type: "element",
    tagName: "figure",
    properties: { className: ["article-figure"], "data-media-id": media.id },
    children,
  };
}

/**
 * Replaces `![alt](media:<id>)` with a `<figure>` carrying a Cloudinary srcset,
 * intrinsic dimensions and an optional caption. Runs before sanitisation so the
 * generated attributes are validated like any other markup.
 */
export function rehypeMediaFigure(options: MediaFigureOptions) {
  return (tree: Root): void => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "img" || index === undefined || !parent) return;

      const target = typeof node.properties.src === "string" ? node.properties.src : null;
      const id = target === null ? null : mediaIdFromTarget(target);
      if (id === null) return;

      const media = options.mediaById.get(id);
      // Unknown ids are left as-is; sanitisation will strip the unresolvable src.
      if (!media) return;

      parent.children[index] = buildFigure(node, media, options);
    });
  };
}