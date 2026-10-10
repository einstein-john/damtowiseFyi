/** Strips code blocks so a README documenting `media:` refs is not scanned for them. */
export function stripCode(markdown: string): string {
  return markdown.replace(/^```[\s\S]*?^```/gm, "").replace(/^~~~[\s\S]*?^~~~/gm, "").replace(/`[^`\n]*`/g, "");
}