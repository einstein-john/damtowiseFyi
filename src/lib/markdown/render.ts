import { toHtml } from "hast-util-to-html";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import type { Root } from "hast";
import type { MediaRef, TocEntry } from "../../contracts/index.js";
import { rehypeMediaFigure } from "./media-figure.js";
import { estimateReadTime } from "./read-time.js";
import { sanitizeSchema } from "./sanitize-schema.js";
import { extractToc } from "./toc.js";

export interface RenderMarkdownOptions {
  cloudName: string;
  mediaById: ReadonlyMap<string, MediaRef>;
}

export interface RenderedMarkdown {
  html: string;
  toc: TocEntry[];
  readTime: number;
}

/**
 * Markdown -> sanitised HTML, plus the derived values stored alongside it.
 *
 * Pipeline order is load-bearing: media figures must be inserted *before*
 * sanitisation so their attributes are validated like any other markup, and
 * heading ids must run last so the TOC matches the anchors in the HTML.
 */
export async function renderMarkdown(
  markdown: string,
  options: RenderMarkdownOptions,
): Promise<RenderedMarkdown> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeMediaFigure, options)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeSlug);

  const tree = (await processor.run(processor.parse(markdown))) as Root;

  return {
    html: toHtml(tree),
    toc: extractToc(tree),
    readTime: estimateReadTime(markdown),
  };
}