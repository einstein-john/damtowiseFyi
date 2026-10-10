import { defaultSchema } from "rehype-sanitize";
import type { Schema } from "hast-util-sanitize";

const IMG_ATTRIBUTES = ["alt", "width", "height", "loading", "decoding"];

/**
 * GitHub's allow-list plus what the media pipeline emits. `srcset`/`sizes` are
 * required for responsive Cloudinary delivery; `figure`/`figcaption` carry captions.
 */
export const sanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "figure", "figcaption", "picture", "source"],
  attributes: {
    ...defaultSchema.attributes,
    img: [...(defaultSchema.attributes?.img ?? []), ...IMG_ATTRIBUTES, "srcSet", "sizes", "role"],
    source: [...(defaultSchema.attributes?.source ?? []), "srcSet", "sizes", "type"],
    code: [...(defaultSchema.attributes?.code ?? []), "className"],
  },
};