import type { Element, Root } from "hast";
import { toString } from "hast-util-to-string";
import type { TocEntry } from "../../contracts/index.js";

const HEADINGS = "h1,h2,h3,h4";

function isHeading(node: Element): boolean {
  return node.type === "element" && HEADINGS.split(",").includes(node.tagName);
}

/**
 * Collects the table of contents after rehype-slug has run, so the slugs in the
 * TOC match the anchors that ended up in the HTML.
 */
export function extractToc(tree: Root): TocEntry[] {
  const entries: TocEntry[] = [];

  walk(tree, (node) => {
    if (!isHeading(node)) return;
    const slug = node.properties.id;
    if (typeof slug !== "string" || slug.length === 0) return;
    entries.push({ depth: Number.parseInt(node.tagName.slice(1), 10), slug, text: toString(node) });
  });

  return entries;
}

function walk(node: Root | Element, visit: (node: Element) => void): void {
  if (node.type !== "root" && node.type !== "element") return;
  for (const child of node.children) {
    if (child.type === "element") {
      visit(child);
      walk(child, visit);
    }
  }
}