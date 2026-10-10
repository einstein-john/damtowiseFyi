import { MEDIA_REF_PREFIX } from "../../contracts/index.js";
import { stripCode } from "./strip-code.js";

const MEDIA_REF_PATTERN = new RegExp(`${MEDIA_REF_PREFIX}([0-9a-fA-F-]{36})`, "g");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isMediaRef(target: string | null | undefined): boolean {
  return typeof target === "string" && target.startsWith(MEDIA_REF_PREFIX);
}

/** Unique media ids referenced from a post body, in first-appearance order. */
export function collectMediaRefs(markdown: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();

  for (const match of stripCode(markdown).matchAll(MEDIA_REF_PATTERN)) {
    const id = match[1];
    if (!id || !UUID_PATTERN.test(id) || seen.has(id)) continue;
    seen.add(id);
    found.push(id);
  }

  return found;
}