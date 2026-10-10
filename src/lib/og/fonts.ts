import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface OgFont {
  name: "JetBrains Mono";
  data: ArrayBuffer;
  weight: 400 | 700;
  style: "normal";
}

const FONT_FILES: ReadonlyArray<{ file: string; weight: OgFont["weight"] }> = [
  { file: "JetBrainsMono-Regular.ttf", weight: 400 },
  { file: "JetBrainsMono-Bold.ttf", weight: 700 },
];

let cachedFonts: OgFont[] | null = null;

/** Bundling the TTFs avoids a network fetch and keeps rendered output deterministic. */
export async function loadOgFonts(fontsDir: string): Promise<OgFont[]> {
  if (cachedFonts) return cachedFonts;

  cachedFonts = await Promise.all(
    FONT_FILES.map(async ({ file, weight }) => {
      const path = resolve(process.cwd(), fontsDir, file);
      const buffer = await readFile(path);
      return {
        name: "JetBrains Mono" as const,
        data: buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength,
        ) as ArrayBuffer,
        weight,
        style: "normal" as const,
      };
    }),
  );

  return cachedFonts;
}